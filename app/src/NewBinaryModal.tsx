import { useState, useCallback, useEffect, useRef } from "react";
import { arrayBufferToHex } from "./lib/hex.ts";

type Tab = "paste" | "upload";

export default function NewBinaryModal({
  onAccept,
  onCancel,
}: {
  onAccept: (name: string, hex: string) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");
  const [name, setName] = useState("");
  const [hex, setHex] = useState("");
  const [uploadedHex, setUploadedHex] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const effectiveHex = tab === "paste" ? hex : (uploadedHex ?? "");
  const canSubmit = name.trim().length > 0 && effectiveHex.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onAccept(name.trim(), effectiveHex);
  }, [name, effectiveHex, canSubmit, onAccept]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!name.trim()) setName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        setUploadedHex(arrayBufferToHex(buffer));
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [name]
  );

  return (
    <div className="modal-backdrop" onClick={onCancel} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>New Binary File</h3>

        <label className="modal-label" htmlFor="bin-name">
          File name
        </label>
        <input
          ref={nameRef}
          id="bin-name"
          className="modal-input"
          placeholder="e.g. packet.bin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === "paste" ? "modal-tab-active" : ""}`}
            onClick={() => setTab("paste")}
          >
            Paste hex buffer
          </button>
          <button
            className={`modal-tab ${tab === "upload" ? "modal-tab-active" : ""}`}
            onClick={() => setTab("upload")}
          >
            Upload file
          </button>
        </div>

        {tab === "paste" && (
          <textarea
            id="bin-hex"
            className="modal-textarea"
            placeholder="Paste hex bytes, e.g.: CA FE 00 04 DE AD BE EF FF"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            spellCheck={false}
          />
        )}

        {tab === "upload" && (
          <div
            className="modal-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (!file) return;
              if (!name.trim()) setName(file.name);
              const reader = new FileReader();
              reader.onload = () => {
                setUploadedHex(arrayBufferToHex(reader.result as ArrayBuffer));
              };
              reader.readAsArrayBuffer(file);
            }}
          >
            {uploadedHex ? (
              <span className="modal-upload-done">File loaded ({Math.ceil(uploadedHex.length / 3)} bytes)</span>
            ) : (
              <span className="modal-upload-hint">Click to browse or drag a file here</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileChange}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
