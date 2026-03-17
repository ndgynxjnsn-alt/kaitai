import { useState, useCallback, useRef } from "react";
import { loadKsyFiles, addKsyFile, removeKsyFile } from "./lib/storage.ts";
import type { KsyFile } from "./lib/storage.ts";
import { hexToArrayBuffer } from "./lib/hex.ts";
import { compileAndParse } from "./lib/kaitai.ts";
import type { ParseResult } from "./lib/kaitai.ts";
import TreeView from "./TreeView.tsx";
import "./App.css";

function App() {
  const [ksyFiles, setKsyFiles] = useState<KsyFile[]>(loadKsyFiles);
  const [selectedKsy, setSelectedKsy] = useState<string>(
    () => loadKsyFiles()[0]?.name ?? ""
  );
  const [hexInput, setHexInput] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
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

    setParsing(true);
    setResult(null);
    try {
      const res = await compileAndParse(ksy.content, buffer);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setParsing(false);
    }
  }, [ksyFiles, selectedKsy, hexInput]);

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
            <textarea
              id="hex-input"
              className="hex-input"
              placeholder="Paste hex bytes, e.g.: 89 50 4E 47 0D 0A 1A 0A ..."
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              spellCheck={false}
            />
            <button
              className="btn btn-primary"
              onClick={handleParse}
              disabled={parsing || !selectedKsy || !hexInput.trim()}
            >
              {parsing ? "Parsing..." : "Parse"}
            </button>
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
