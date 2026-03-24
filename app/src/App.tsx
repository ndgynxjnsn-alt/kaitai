import { useCallback, useEffect, useState } from "react";
import "./App.css";
import FileTree from "./FileTree.tsx";
import HexInput from "./HexInput.tsx";
import KsyEditor from "./KsyEditor.tsx";
import { hexToArrayBuffer } from "./lib/hex.ts";
import { useFsStore } from "./lib/fsStore.ts";
import type { ParseResult } from "./lib/kaitai.ts";
import { compileAndParse } from "./lib/kaitai.ts";
import TreeView from "./TreeView.tsx";

function App() {
  const entries = useFsStore((s) => s.entries);
  const openFile = useFsStore((s) => s.openFile);
  const writeFile = useFsStore((s) => s.writeFile);

  const openFileContent = openFile ? (entries[openFile] ?? "") : "";

  const [hexInput, setHexInput] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);

  const handleEditorChange = useCallback(
    (content: string) => {
      if (openFile) writeFile(openFile, content);
    },
    [openFile, writeFile]
  );

  const handleParse = useCallback(async () => {
    if (!openFile || !openFileContent) {
      setResult({ success: false, error: "No KSY file selected" });
      return;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = hexToArrayBuffer(hexInput);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    setResult(null);
    try {
      const res = await compileAndParse(openFileContent, buffer);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [openFile, openFileContent, hexInput]);

  // Auto-parse whenever hex input or open file content changes
  useEffect(() => {
    if (openFile && openFileContent && hexInput.trim()) {
      handleParse();
    } else {
      setResult(null);
    }
  }, [hexInput, openFile, openFileContent, handleParse]);

  return (
    <div className="app">
      <header>
        <h1>Kaitai Hex Validator</h1>
      </header>

      <div className="layout">
        <FileTree />

        <section className="editor-panel">
          {openFile ? (
            <KsyEditor
              value={openFileContent}
              onChange={handleEditorChange}
            />
          ) : (
            <div className="editor-placeholder">
              Select or upload a .ksy file to edit
            </div>
          )}
        </section>

        <main>
          <section className="input-section">
            <label htmlFor="hex-input">Hex Buffer</label>
            <HexInput value={hexInput} onChange={setHexInput} />
          </section>

          <section className="result-section">
            {result && !result.success && (
              <div className="error">
                <strong>Error:</strong> {result.error}
              </div>
            )}
            {result && result.success && result.tree && (
              <div className="success">
                <h3>Parsed Structure</h3>
                <TreeView root={result.tree} />
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
