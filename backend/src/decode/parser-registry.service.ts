import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import KaitaiStructCompiler from 'kaitai-struct-compiler';
import KaitaiStream from 'kaitai-struct/KaitaiStream';

export interface CompiledParser {
  id: string;
  ksyPath: string;
  parserClass: new (stream: any, parent: any, root: any) => any;
}

export interface TreeNode {
  name: string;
  type: 'object' | 'array' | 'bytes' | 'primitive';
  range?: { start: number; end: number };
  className?: string;
  value?: string | number | boolean | null;
  hexValue?: string;
  bytesPreview?: string;
  bytesLength?: number;
  arrayLength?: number;
  children?: TreeNode[];
}

interface DebugInfo {
  start?: number;
  end?: number;
  ioOffset?: number;
  arr?: DebugInfo[];
}

@Injectable()
export class ParserRegistryService {
  private readonly logger = new Logger(ParserRegistryService.name);
  private readonly parsers = new Map<string, CompiledParser>();

  /** Compile a .ksy YAML string and register the parser. */
  async register(ksyPath: string, ksyYaml: string): Promise<string | null> {
    let ksyObject: Record<string, unknown>;
    try {
      const parsed = yaml.load(ksyYaml);
      if (!parsed || typeof parsed !== 'object') return null;
      ksyObject = parsed as Record<string, unknown>;
    } catch {
      this.logger.warn(`Invalid YAML in ${ksyPath}, skipping`);
      return null;
    }

    const meta = ksyObject.meta as Record<string, unknown> | undefined;
    const id = meta?.id as string | undefined;
    if (!id) {
      this.logger.warn(`No meta.id in ${ksyPath}, skipping`);
      return null;
    }

    const importer = {
      importYaml(): Promise<unknown> {
        return Promise.reject(new Error('Imports not supported'));
      },
    };

    let compiledFiles: Record<string, string>;
    try {
      compiledFiles = await KaitaiStructCompiler.compile(
        'javascript',
        ksyObject,
        importer,
        true, // debug mode for _debug info
      );
    } catch (e: any) {
      this.logger.warn(`Compilation failed for ${ksyPath}: ${e.message}`);
      return null;
    }

    const jsCode = Object.values(compiledFiles).join('\n');

    // Execute the AMD-wrapped generated code
    const classes: Record<string, any> = {};
    const fakeDefine: any = (
      _deps: string[],
      factory: (exports: Record<string, any>, ks: any) => void,
    ) => {
      factory(classes, KaitaiStream);
    };
    fakeDefine.amd = true;

    const fn = new Function('define', 'KaitaiStream', jsCode);
    fn(fakeDefine, KaitaiStream);

    const mainClassName = Object.keys(classes)[0];
    if (!mainClassName || !classes[mainClassName]) {
      this.logger.warn(`No parser class produced for ${ksyPath}`);
      return null;
    }

    this.parsers.set(id, {
      id,
      ksyPath,
      parserClass: classes[mainClassName],
    });
    this.logger.log(`Registered parser "${id}" from ${ksyPath}`);
    return id;
  }

  /** Remove the parser compiled from a given .ksy path. */
  removeByPath(ksyPath: string): void {
    for (const [id, parser] of this.parsers) {
      if (parser.ksyPath === ksyPath) {
        this.parsers.delete(id);
        this.logger.log(`Removed parser "${id}"`);
        return;
      }
    }
  }

  /** Get all registered parsers. */
  getAll(): CompiledParser[] {
    return Array.from(this.parsers.values());
  }

  /** Parse a binary buffer with a single parser. */
  parseWith(
    parser: CompiledParser,
    buffer: ArrayBuffer,
  ): { success: boolean; tree?: TreeNode; error?: string } {
    try {
      const stream = new KaitaiStream(buffer, 0);
      const parsed = new parser.parserClass(stream, null, null);
      parsed._read();
      const tree = buildTreeNode(parser.id, parsed, parsed._debug);
      return { success: true, tree };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

// ── Tree building (ported from frontend kaitai.ts) ──

function getRange(
  debug: DebugInfo | undefined,
): { start: number; end: number } | undefined {
  if (
    !debug ||
    typeof debug.start !== 'number' ||
    typeof debug.end !== 'number'
  )
    return undefined;
  const offset = debug.ioOffset ?? 0;
  return { start: offset + debug.start, end: offset + debug.end };
}

function buildTreeNode(
  name: string,
  obj: unknown,
  debug: Record<string, DebugInfo> | undefined,
  depth = 0,
): TreeNode {
  if (depth > 30) {
    return { name, type: 'primitive', value: '[max depth]' };
  }

  if (obj === null || obj === undefined) {
    return { name, type: 'primitive', value: obj ?? null };
  }

  // Byte arrays
  if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
    const bytes = obj instanceof ArrayBuffer ? new Uint8Array(obj) : obj;
    const preview = Array.from(bytes.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    return {
      name,
      type: 'bytes',
      bytesPreview: bytes.length > 16 ? preview + ' ...' : preview,
      bytesLength: bytes.length,
    };
  }

  // Arrays
  if (Array.isArray(obj)) {
    const children = obj.map((item, i) => {
      const itemDebug = debug as unknown as DebugInfo;
      const childDebugInfo = itemDebug?.arr?.[i];
      const childObj = item as Record<string, unknown>;
      const childDebug =
        childObj && typeof childObj === 'object' && !Array.isArray(childObj)
          ? (childObj._debug as Record<string, DebugInfo> | undefined)
          : undefined;
      const node = buildTreeNode(String(i), item, childDebug, depth + 1);
      if (childDebugInfo) {
        node.range = getRange(childDebugInfo);
      }
      return node;
    });
    return { name, type: 'array', arrayLength: obj.length, children };
  }

  // Objects (parsed kaitai structs)
  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const className = (record.constructor as any)?.name;
    const objDebug = record._debug as Record<string, DebugInfo> | undefined;

    const children: TreeNode[] = [];
    for (const key of Object.keys(record)) {
      if (key.startsWith('_')) continue;
      const fieldDebug = objDebug?.[key];
      const childVal = record[key];
      const childObj = childVal as Record<string, unknown>;
      const childObjDebug =
        childVal && typeof childVal === 'object' && !Array.isArray(childVal)
          ? (childObj._debug as Record<string, DebugInfo> | undefined)
          : undefined;
      const node = buildTreeNode(key, childVal, childObjDebug, depth + 1);
      if (fieldDebug) {
        node.range = getRange(fieldDebug);
      }
      children.push(node);
    }

    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const child of children) {
      if (child.range) {
        minStart = Math.min(minStart, child.range.start);
        maxEnd = Math.max(maxEnd, child.range.end);
      }
    }

    return {
      name,
      type: 'object',
      className: className && className !== 'Object' ? className : undefined,
      children,
      range: minStart < Infinity ? { start: minStart, end: maxEnd } : undefined,
    };
  }

  // Primitives
  const node: TreeNode = {
    name,
    type: 'primitive',
    value: obj as string | number | boolean,
  };
  if (typeof obj === 'number' && Number.isInteger(obj)) {
    node.hexValue = '0x' + obj.toString(16).toUpperCase();
  }
  return node;
}
