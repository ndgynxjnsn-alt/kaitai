import { useState, useCallback, useRef } from "react";
import { useFsStore, buildTree } from "./lib/fsStore.ts";
import type { FsNode } from "./lib/fsStore.ts";

function FileTreeNode({ node, depth }: { node: FsNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const openFile = useFsStore((s) => s.openFile);
  const setOpenFile = useFsStore((s) => s.setOpenFile);
  const deleteEntry = useFsStore((s) => s.deleteEntry);

  const isSelected = !node.isFolder && openFile === node.path;

  const handleClick = useCallback(() => {
    if (node.isFolder) {
      setOpen((o) => !o);
    } else {
      setOpenFile(node.path);
    }
  }, [node, setOpenFile]);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const tree = buildTree(entries);

  const handleUpload = useCallback(() => {
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
          <button className="btn btn-sm" onClick={handleUpload} title="Upload .ksy file">
            + File
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
    </aside>
  );
}
