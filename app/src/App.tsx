import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import HexInput from "./HexInput.tsx";
import { hexToArrayBuffer } from "./lib/hex.ts";
import type { ParseResult } from "./lib/kaitai.ts";
import { compileAndParse } from "./lib/kaitai.ts";
import type { KsyFile } from "./lib/storage.ts";
import { addKsyFile, loadKsyFiles, removeKsyFile } from "./lib/storage.ts";
import TreeView from "./TreeView.tsx";

function App() {
  const [ksyFiles, setKsyFiles] = useState<KsyFile[]>(loadKsyFiles);
  const [selectedKsy, setSelectedKsy] = useState<string>(
    () => loadKsyFiles()[0]?.name ?? ""
  );
  const [hexInput, setHexInput] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddKsy = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          const updated = addKsyFile({ name: file.name, content });
          setKsyFiles(updated);
          if (!selectedKsy || updated.length === 1) {
            setSelectedKsy(file.name);
          }
        };
        reader.readAsText(file);
      });
      e.target.value = "";
    },
    [selectedKsy]
  );

  const handleRemoveKsy = useCallback(
    (name: string) => {
      const updated = removeKsyFile(name);
      setKsyFiles(updated);
      if (selectedKsy === name) {
        setSelectedKsy(updated[0]?.name ?? "");
      }
    },
    [selectedKsy]
  );

  const handleParse = useCallback(async () => {
    const ksy = ksyFiles.find((f) => f.name === selectedKsy);
    if (!ksy) {
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
      const res = await compileAndParse(ksy.content, buffer);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [ksyFiles, selectedKsy, hexInput]);

  // Auto-parse whenever hex input or selected KSY changes
  useEffect(() => {
    if (selectedKsy && hexInput.trim()) {
      handleParse();
    } else {
      setResult(null);
    }
  }, [hexInput, selectedKsy, handleParse]);

  return (
    <div className="app">
      <header>
        <h1>Kaitai Hex Validator</h1>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>KSY Files</h2>
            <button className="btn btn-sm" onClick={handleAddKsy}>
              + Add
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ksy,.yaml,.yml"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </div>
          <ul className="ksy-list">
            {ksyFiles.length === 0 && (
              <li className="empty">No .ksy files loaded</li>
            )}
            {ksyFiles.map((f) => (
              <li
                key={f.name}
                className={f.name === selectedKsy ? "selected" : ""}
                onClick={() => setSelectedKsy(f.name)}
              >
                <span className="ksy-name">{f.name}</span>
                <button
                  className="btn-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveKsy(f.name);
                  }}
                  title="Remove"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </aside>

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
