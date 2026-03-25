declare module 'kaitai-struct-compiler' {
  interface Importer {
    importYaml(name: string, mode: string): Promise<unknown>;
  }

  const KaitaiStructCompiler: {
    compile(
      lang: string,
      ksy: Record<string, unknown>,
      importer: Importer,
      debug: boolean,
    ): Promise<Record<string, string>>;
  };

  export default KaitaiStructCompiler;
}

declare module 'kaitai-struct/KaitaiStream' {
  class KaitaiStream {
    constructor(buffer: ArrayBuffer, offset: number);
  }
  export default KaitaiStream;
}
