# Kaitai Hex Validator

A browser-based tool for validating hex buffer strings against [Kaitai Struct](https://kaitai.io/) (.ksy) schema files. Paste hex bytes, pick a schema, and instantly see the parsed structure as an interactive tree.

Inspired by the [Kaitai Struct WebIDE](https://github.com/kaitai-io/kaitai_struct_webide) but intentionally simpler: no window manager, no file-based buffers — just a textarea and a tree view.

## Features

- **Hex input** — paste hex in any common format: `AB CD`, `ABCDEF`, `0xAB`, `AB:CD`
- **KSY file management** — add/remove .ksy files via file picker, persisted in localStorage
- **Live parsing** — auto-parses whenever the hex input or selected .ksy changes
- **Interactive object tree** — collapsible tree view with color-coded types (integers shown as hex + decimal, byte arrays as hex preview, strings in orange, etc.)
- **Bidirectional highlighting** — hover a tree node to highlight the corresponding bytes in the hex input (CSS Highlight API); select bytes in the textarea to highlight matching tree nodes
- **Debug byte ranges** — compiled with Kaitai's debug flag to track `start`/`end` offsets per field

## Tech stack

- React 19 + TypeScript + Vite
- [kaitai-struct-compiler](https://www.npmjs.com/package/kaitai-struct-compiler) — Scala-to-JS compiler, compiles .ksy YAML to JavaScript parsers at runtime
- [kaitai-struct](https://www.npmjs.com/package/kaitai-struct) — KaitaiStream runtime for binary parsing
- [Zustand](https://github.com/pmndrs/zustand) — lightweight state for highlight coordination
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML parsing
- Vitest for testing

## Getting started

```bash
cd app
npm install
npm run dev
```

## Testing

```bash
npm run test
```

Tests cover core compile-and-parse logic: simple packet parsing, TLV messages with nested types, debug byte ranges, error handling for invalid YAML, unsupported imports, and truncated buffers.

## Example: simple_packet

**simple.ksy:**
```yaml
meta:
  id: simple_packet
  endian: be
seq:
  - id: magic
    type: u2
  - id: length
    type: u2
  - id: payload
    size: length
  - id: checksum
    type: u1
```

**Hex input:**
```
CA FE 00 04 DE AD BE EF FF
```

This parses as: magic=0xCAFE, length=4, payload=`de ad be ef` (4 bytes), checksum=0xFF.

## Architecture

```
app/src/
  lib/
    kaitai.ts          # Core: YAML -> compile -> AMD intercept -> parse -> tree
    hex.ts             # Hex string <-> ArrayBuffer conversion
    storage.ts         # localStorage CRUD for .ksy files
    highlightStore.ts  # Zustand store for bidirectional highlight state
  stubs/
    zlib.ts            # Browser stub (KaitaiStream optionally imports Node modules)
    iconv-lite.ts      # Browser stub
  App.tsx              # Main layout: sidebar + hex input + tree view
  TreeView.tsx         # Collapsible tree with hover -> highlight
  HexInput.tsx         # Textarea with CSS Highlight API mirror overlay
```

### How compilation works

1. Parse .ksy YAML with js-yaml
2. Compile to JavaScript via `KaitaiStructCompiler.compile("javascript", ksy, importer, debug=true)`
3. The compiler emits UMD/AMD wrappers: `define(['exports', 'kaitai-struct/KaitaiStream'], factory)`
4. Intercept `define()` with a fake AMD loader that injects `KaitaiStream` and captures exported classes
5. Instantiate the parser class with a `KaitaiStream` wrapping the hex buffer
6. Recursively walk the parsed object and `_debug` metadata to build a `TreeNode` tree with byte ranges

### Limitations

- **No imports** — .ksy files that use `meta.imports` are not supported (the importer rejects them)
- **Browser only** — `zlib` and `iconv-lite` are stubbed out, so .ksy schemas relying on zlib decompression or exotic encodings won't work
