import yaml from "js-yaml";
import KaitaiStructCompiler from "kaitai-struct-compiler";
import { KaitaiStream } from "kaitai-struct";

/** Node types in the parsed tree */
export type TreeNodeType = "object" | "array" | "bytes" | "primitive";

export interface TreeNode {
  name: string;
  type: TreeNodeType;
  /** For objects: the kaitai class name */
  className?: string;
  /** For primitives: the raw value */
  value?: string | number | boolean | null;
  /** For integers: hex representation */
  hexValue?: string;
  /** For bytes: hex preview string */
  bytesPreview?: string;
  /** For bytes: full length */
  bytesLength?: number;
  /** For arrays: item count */
  arrayLength?: number;
  /** Child nodes (object fields, array items) */
  children?: TreeNode[];
}

export interface ParseResult {
  success: boolean;
  tree?: TreeNode;
  error?: string;
}

/**
 * Compile a .ksy YAML string and parse the given buffer with it.
 */
export async function compileAndParse(
  ksyYaml: string,
  buffer: ArrayBuffer
): Promise<ParseResult> {
  // 1. Parse the YAML
  const ksyObject = yaml.load(ksyYaml) as Record<string, unknown> | null;
  if (!ksyObject || typeof ksyObject !== "object") {
    return { success: false, error: "Invalid KSY: not a valid YAML object" };
  }

  const rootClassName =
    (ksyObject.meta as Record<string, unknown> | undefined)?.id as
      | string
      | undefined;

  // 2. Compile to JavaScript
  const importer = {
    importYaml(_name: string, _mode: string): Promise<unknown> {
      return Promise.reject(
        new Error(`Imports are not supported. Referenced: ${_name}`)
      );
    },
  };

  const compiledFiles = await KaitaiStructCompiler.compile(
    "javascript",
    ksyObject,
    importer,
    false
  );

  // 3. Join all generated source files
  const jsCode = Object.values(compiledFiles).join("\n");

  // 4. Execute the generated code to get the parser class.
  //    The compiler emits a UMD wrapper:
  //      define(['exports', 'kaitai-struct/KaitaiStream'], function(exports, KaitaiStream) { ... })
  //    The factory populates the exports object and the constructor calls _read() internally.
  const classes: Record<string, unknown> = {};

  const fakeDefine = (
    _deps: string[],
    factory: (exports: Record<string, unknown>, ks: typeof KaitaiStream) => void
  ) => {
    factory(classes, KaitaiStream);
  };
  (fakeDefine as unknown as Record<string, boolean>).amd = true;

  const fn = new Function("define", "KaitaiStream", jsCode);
  fn(fakeDefine, KaitaiStream);

  // The main class is exported under its PascalCase name (e.g. SimplePacket.SimplePacket)
  const mainClassName = Object.keys(classes)[0];
  const MainClass = mainClassName
    ? (classes[mainClassName] as new (stream: KaitaiStream) => Record<string, unknown>)
    : null;

  if (!MainClass) {
    return { success: false, error: "Compilation produced no parser class" };
  }

  // 5. Instantiate and parse (_read() is called by the constructor)
  const stream = new KaitaiStream(buffer, 0);
  const parsed = new MainClass(stream);

  // 6. Build the tree
  const tree = buildTreeNode(rootClassName ?? "root", parsed);
  return { success: true, tree };
}

function buildTreeNode(name: string, obj: unknown, depth = 0): TreeNode {
  if (depth > 30) {
    return { name, type: "primitive", value: "[max depth]" };
  }

  if (obj === null || obj === undefined) {
    return { name, type: "primitive", value: obj ?? null };
  }

  // Byte arrays
  if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
    const bytes = obj instanceof ArrayBuffer ? new Uint8Array(obj) : obj;
    const preview = Array.from(bytes.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    return {
      name,
      type: "bytes",
      bytesPreview: bytes.length > 16 ? preview + " ..." : preview,
      bytesLength: bytes.length,
    };
  }

  // Arrays
  if (Array.isArray(obj)) {
    const children = obj.map((item, i) =>
      buildTreeNode(String(i), item, depth + 1)
    );
    return { name, type: "array", arrayLength: obj.length, children };
  }

  // Objects (parsed kaitai structs)
  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    const className = record.constructor?.name;

    const children: TreeNode[] = [];
    for (const key of Object.keys(record)) {
      if (key.startsWith("_")) continue;
      children.push(buildTreeNode(key, record[key], depth + 1));
    }

    return {
      name,
      type: "object",
      className: className && className !== "Object" ? className : undefined,
      children,
    };
  }

  // Primitives
  const node: TreeNode = { name, type: "primitive", value: obj as string | number | boolean };
  if (typeof obj === "number" && Number.isInteger(obj)) {
    node.hexValue = "0x" + obj.toString(16).toUpperCase();
  }
  return node;
}
