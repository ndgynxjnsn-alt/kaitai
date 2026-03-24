import { useCallback, useEffect, useState, useRef } from "react";
import "./App.css";
import FileTree from "./FileTree.tsx";
import HexViewer from "./HexViewer.tsx";
import KsyEditor from "./KsyEditor.tsx";
import { hexToArrayBuffer, arrayBufferToHex } from "./lib/hex.ts";
import { useFsStore, isKsyFile } from "./lib/fsStore.ts";
import type { ParseResult } from "./lib/kaitai.ts";
import { compileAndParse } from "./lib/kaitai.ts";
import TreeView from "./TreeView.tsx";

function App() {
  const entries = useFsStore((s) => s.entries);
  const openFile = useFsStore((s) => s.openFile);
  const selectedBinary = useFsStore((s) => s.selectedBinary);
  const writeFile = useFsStore((s) => s.writeFile);
  const setOpenFile = useFsStore((s) => s.setOpenFile);
  const setSelectedBinary = useFsStore((s) => s.setSelectedBinary);

  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const openFileContent =
    openFile && isKsyFile(openFile) ? (entries[openFile] ?? "") : "";
  const binaryHex = selectedBinary ? (entries[selectedBinary] ?? "") : "";

  const [result, setResult] = useState<ParseResult | null>(null);

  const handleEditorChange = useCallback(
    (content: string) => {
      if (openFile) writeFile(openFile, content);
    },
    [openFile, writeFile]
  );

  const handleParse = useCallback(async () => {
    if (!openFileContent) {
      setResult(null);
      return;
    }
    if (!binaryHex.trim()) {
      setResult(null);
      return;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = hexToArrayBuffer(binaryHex);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    try {
      const res = await compileAndParse(openFileContent, buffer);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [openFileContent, binaryHex]);

  // Auto-parse whenever KSY content or binary file changes
  useEffect(() => {
    if (openFileContent && binaryHex.trim()) {
      handleParse();
    } else {
      setResult(null);
    }
  }, [openFileContent, binaryHex, handleParse]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);

      const files = e.dataTransfer.files;
      if (!files.length) return;

      Array.from(files).forEach((file) => {
        const path = "/" + file.name;
        if (isKsyFile(file.name)) {
          const reader = new FileReader();
          reader.onload = () => {
            writeFile(path, reader.result as string);
            setOpenFile(path);
          };
          reader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            writeFile(path, arrayBufferToHex(reader.result as ArrayBuffer));
            setSelectedBinary(path);
          };
          reader.readAsArrayBuffer(file);
        }
      });
    },
    [writeFile, setOpenFile, setSelectedBinary]
  );

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            Drop files to import
            <span className="drop-overlay-hint">.ksy files open in editor, others import as binary</span>
          </div>
        </div>
      )}
      <header>
        <h1>Kaitai Hex Validator</h1>
      </header>

      <div className="layout">
        <FileTree />

        <section className="editor-panel">
          {openFile && isKsyFile(openFile) ? (
            <KsyEditor value={openFileContent} onChange={handleEditorChange} />
          ) : (
            <div className="editor-placeholder">
              Select a .ksy file to edit
            </div>
          )}
        </section>

        <main>
          <section className="input-section">
            <label>
              Binary File
              {selectedBinary && (
                <span className="label-detail"> — {selectedBinary}</span>
              )}
            </label>
            {binaryHex ? (
              <HexViewer hex={binaryHex} />
            ) : (
              <div className="hex-empty">
                No binary file selected. Upload or create one from the sidebar.
              </div>
            )}
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
