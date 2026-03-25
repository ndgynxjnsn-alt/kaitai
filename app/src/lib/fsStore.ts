import { create } from "zustand";
import * as remote from "./api.ts";

/**
 * Flat path-based filesystem backed by the REST API.
 *
 * Paths use "/" separators. Files don't end with "/".
 * The backend (S3) is the source of truth.
 * Content is fetched lazily when a file is opened/selected.
 */

export interface FsState {
  /** path → content for files whose content has been fetched.
   *  A path present with null means "known to exist but not yet fetched". */
  entries: Record<string, string | null>;
  /** Currently open file path in the editor (null = nothing open) */
  openFile: string | null;
  /** Currently selected binary file for parsing (null = none) */
  selectedBinary: string | null;
  /** True while the initial file list is loading */
  loading: boolean;

  // Remote-backed operations (all async)
  fetchFileList: () => Promise<void>;
  fetchFileContent: (path: string) => Promise<string | null>;
  writeFile: (path: string, content: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;

  // Local-only editor state
  setOpenFile: (path: string | null) => void;
  setSelectedBinary: (path: string | null) => void;

  /** Update content locally without writing to server (e.g. editor typing). */
  setLocalContent: (path: string, content: string) => void;
  /** Flush a file's local content to the server. */
  saveFile: (path: string) => Promise<void>;
}

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : "/" + p;
}

export const useFsStore = create<FsState>()((set, get) => ({
  entries: {},
  openFile: null,
  selectedBinary: null,
  loading: true,

  async fetchFileList() {
    set({ loading: true });
    try {
      const files = await remote.listFiles();
      const entries: Record<string, string | null> = {};
      for (const f of files) {
        entries[f] = get().entries[f] ?? null; // preserve already-fetched content
      }
      set({ entries, loading: false });
    } catch (err) {
      console.error("Failed to fetch file list:", err);
      set({ loading: false });
    }
  },

  async fetchFileContent(path: string) {
    path = normalizePath(path);
    const content = await remote.getFile(path);
    if (content !== null) {
      set((s) => ({ entries: { ...s.entries, [path]: content } }));
    }
    return content;
  },

  async writeFile(path: string, content: string) {
    path = normalizePath(path);
    await remote.putFile(path, content);
    set((s) => ({ entries: { ...s.entries, [path]: content } }));
  },

  async deleteEntry(path: string) {
    path = normalizePath(path);
    // If it looks like a folder prefix, delete all children
    if (path.endsWith("/")) {
      const { entries } = get();
      const toDelete = Object.keys(entries).filter(
        (k) => k === path || k.startsWith(path)
      );
      await Promise.all(toDelete.map((k) => remote.deleteFile(k)));
      const next = { ...entries };
      for (const k of toDelete) delete next[k];
      const updates: Partial<FsState> = { entries: next };
      const { openFile, selectedBinary } = get();
      if (openFile && (openFile === path || openFile.startsWith(path))) {
        updates.openFile = null;
      }
      if (
        selectedBinary &&
        (selectedBinary === path || selectedBinary.startsWith(path))
      ) {
        updates.selectedBinary = null;
      }
      set(updates);
    } else {
      await remote.deleteFile(path);
      const { entries, openFile, selectedBinary } = get();
      const next = { ...entries };
      delete next[path];
      const updates: Partial<FsState> = { entries: next };
      if (openFile === path) updates.openFile = null;
      if (selectedBinary === path) updates.selectedBinary = null;
      set(updates);
    }
  },

  setOpenFile(path) {
    set({ openFile: path ? normalizePath(path) : null });
  },

  setSelectedBinary(path) {
    set({ selectedBinary: path ? normalizePath(path) : null });
  },

  setLocalContent(path: string, content: string) {
    path = normalizePath(path);
    set((s) => ({ entries: { ...s.entries, [path]: content } }));
  },

  async saveFile(path: string) {
    path = normalizePath(path);
    const content = get().entries[path];
    if (content != null) {
      await remote.putFile(path, content);
    }
  },
}));

// ── Derived helpers (pure functions, not in store) ──

const KSY_EXTENSIONS = [".ksy", ".yaml", ".yml"];

export function isKsyFile(path: string): boolean {
  return KSY_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

export interface FsNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FsNode[];
}

/** Build a tree from the flat entries map, rooted at parentPath */
export function buildTree(
  entries: Record<string, string | null>,
  parentPath = "/"
): FsNode[] {
  const childSet = new Map<string, boolean>(); // name → isFolder

  for (const key of Object.keys(entries)) {
    if (!key.startsWith(parentPath) || key === parentPath) continue;
    const rest = key.slice(parentPath.length);
    const slashIdx = rest.indexOf("/");

    if (slashIdx === -1) {
      // Direct file child
      childSet.set(rest, false);
    } else {
      // Folder (take only immediate folder name)
      const folderName = rest.slice(0, slashIdx);
      childSet.set(folderName, true);
    }
  }

  const nodes: FsNode[] = [];
  for (const [name, isFolder] of childSet) {
    const path = parentPath + name + (isFolder ? "/" : "");
    const node: FsNode = { name, path, isFolder };
    if (isFolder) {
      node.children = buildTree(entries, path);
    }
    nodes.push(node);
  }

  // Sort: folders first, then alphabetical
  nodes.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}
