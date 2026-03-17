declare module "kaitai-struct-compiler" {
  namespace KaitaiStructCompiler {
    const version: string;
    const buildDate: string;
    function compile(
      kslang: string,
      compilerSchema: unknown,
      jsImporter: { importYaml(name: string, mode: string): Promise<unknown> },
      isDebug: boolean
    ): Promise<Record<string, string>>;
  }
  export = KaitaiStructCompiler;
}

declare module "kaitai-struct" {
  class KaitaiStream {
    constructor(arrayBuffer: ArrayBuffer | number, byteOffset?: number);
    pos: number;
    size: number;
    isEof(): boolean;
    seek(pos: number): void;
    readU1(): number;
    readBytes(len: number): Uint8Array;
    readBytesFull(): Uint8Array;
    static bytesToStr(arr: Uint8Array, encoding: string): string;
  }
  export { KaitaiStream };
}
