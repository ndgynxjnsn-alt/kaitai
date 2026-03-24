import { useState, useCallback, useRef } from "react";
import { useFsStore, buildTree, isKsyFile } from "./lib/fsStore.ts";
import type { FsNode } from "./lib/fsStore.ts";
import NewBinaryModal from "./NewBinaryModal.tsx";

function FileTreeNode({ node, depth }: { node: FsNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const openFile = useFsStore((s) => s.openFile);
  const selectedBinary = useFsStore((s) => s.selectedBinary);
  const setOpenFile = useFsStore((s) => s.setOpenFile);
  const setSelectedBinary = useFsStore((s) => s.setSelectedBinary);
  const deleteEntry = useFsStore((s) => s.deleteEntry);

  const isKsy = !node.isFolder && isKsyFile(node.path);
  const isBin = !node.isFolder && !isKsy;
  const isSelected =
    (!node.isFolder && isKsy && openFile === node.path) ||
    (!node.isFolder && isBin && selectedBinary === node.path);

  const handleClick = useCallback(() => {
    if (node.isFolder) {
      setOpen((o) => !o);
    } else if (isKsyFile(node.path)) {
      setOpenFile(node.path);
    } else {
      setSelectedBinary(node.path);
    }
  }, [node, setOpenFile, setSelectedBinary]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteEntry(node.path);
    },
    [node.path, deleteEntry]
  );

  return (
    <li>
      <div
        className={`ft-row ${isSelected ? "ft-selected" : ""}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleClick}
      >
        {node.isFolder && (
          <span className="ft-toggle">{open ? "\u25BE" : "\u25B8"}</span>
        )}
        {!node.isFolder && <span className="ft-icon">{"  "}</span>}
        <span className={node.isFolder ? "ft-folder-name" : "ft-file-name"}>
          {node.name}
        </span>
        {isBin && <span className="ft-badge">BIN</span>}
        <button
          className="btn-remove ft-delete"
          onClick={handleDelete}
          title="Delete"
        >
          &times;
        </button>
      </div>
      {node.isFolder && open && node.children && (
        <ul className="ft-children">
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FileTree() {
  const entries = useFsStore((s) => s.entries);
  const writeFile = useFsStore((s) => s.writeFile);
  const createFolder = useFsStore((s) => s.createFolder);
  const setOpenFile = useFsStore((s) => s.setOpenFile);
  const setSelectedBinary = useFsStore((s) => s.setSelectedBinary);
  const ksyInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showBinaryModal, setShowBinaryModal] = useState(false);

  const tree = buildTree(entries);

  const handleUploadKsy = useCallback(() => {
    ksyInputRef.current?.click();
  }, []);

  const handleKsyFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          const path = "/" + file.name;
          writeFile(path, content);
          setOpenFile(path);
        };
        reader.readAsText(file);
      });
      e.target.value = "";
    },
    [writeFile, setOpenFile]
  );

  const handleNewBinaryAccept = useCallback(
    (name: string, hex: string) => {
      const fileName = name.includes(".") ? name : name + ".bin";
      const path = "/" + fileName;
      writeFile(path, hex);
      setSelectedBinary(path);
      setShowBinaryModal(false);
    },
    [writeFile, setSelectedBinary]
  );

  const handleNewFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder("/" + name + "/");
    setNewFolderName("");
    setShowNewFolder(false);
  }, [newFolderName, createFolder]);

  const handleFolderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleNewFolder();
      if (e.key === "Escape") setShowNewFolder(false);
    },
    [handleNewFolder]
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Files</h2>
        <div className="sidebar-actions">
          <button
            className="btn btn-sm"
            onClick={() => setShowNewFolder(true)}
            title="New folder"
          >
            + Folder
          </button>
          <button className="btn btn-sm" onClick={handleUploadKsy} title="Upload .ksy file">
            + KSY
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setShowBinaryModal(true)}
            title="New binary file"
          >
            + Binary
          </button>
          <input
            ref={ksyInputRef}
            type="file"
            accept=".ksy,.yaml,.yml"
            multiple
            hidden
            onChange={handleKsyFileChange}
          />
        </div>
      </div>

      {showNewFolder && (
        <div className="ft-new-folder">
          <input
            autoFocus
            className="ft-new-folder-input"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={handleFolderKeyDown}
            onBlur={() => setShowNewFolder(false)}
          />
        </div>
      )}

      <ul className="ft-root">
        {tree.length === 0 && (
          <li className="ft-empty">No files yet</li>
        )}
        {tree.map((node) => (
          <FileTreeNode key={node.path} node={node} depth={0} />
        ))}
      </ul>

      {showBinaryModal && (
        <NewBinaryModal
          onAccept={handleNewBinaryAccept}
          onCancel={() => setShowBinaryModal(false)}
        />
      )}
    </aside>
  );
}
