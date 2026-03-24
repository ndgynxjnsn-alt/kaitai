import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Flat path-based filesystem persisted in localStorage.
 *
 * Paths use "/" separators. Folders end with "/", files don't.
 * Root is "/". Example: "/protocols/simple.ksy", "/protocols/"
 *
 * Only file content is stored (as strings). Folders are implicit
 * from file paths, but can also be created empty.
 */

export interface FsState {
  /** path → content for files; path (ending "/") → null for empty folders */
  entries: Record<string, string | null>;
  /** Currently open file path (null = nothing open) */
  openFile: string | null;

  // File operations
  writeFile: (path: string, content: string) => void;
  deleteEntry: (path: string) => void;
  renameEntry: (oldPath: string, newPath: string) => void;

  // Folder operations
  createFolder: (path: string) => void;

  // Editor state
  setOpenFile: (path: string | null) => void;
}

/** Ensure a path starts with "/" */
function normalizePath(p: string): string {
  return p.startsWith("/") ? p : "/" + p;
}

export const useFsStore = create<FsState>()(
  persist(
    (set, get) => ({
      entries: {},
      openFile: null,

      writeFile(path, content) {
        path = normalizePath(path);
        set((s) => ({ entries: { ...s.entries, [path]: content } }));
      },

      deleteEntry(path) {
        path = normalizePath(path);
        const { entries, openFile } = get();
        const next = { ...entries };

        if (path.endsWith("/")) {
          // Delete folder and everything inside it
          for (const key of Object.keys(next)) {
            if (key === path || key.startsWith(path)) {
              delete next[key];
            }
          }
        } else {
          delete next[path];
        }

        const updates: Partial<FsState> = { entries: next };
        // If the open file was deleted, close it
        if (openFile && (openFile === path || openFile.startsWith(path))) {
          updates.openFile = null;
        }
        set(updates);
      },

      renameEntry(oldPath, newPath) {
        oldPath = normalizePath(oldPath);
        newPath = normalizePath(newPath);
        const { entries, openFile } = get();
        const next = { ...entries };

        if (oldPath.endsWith("/")) {
          // Rename folder: move all children
          for (const key of Object.keys(next)) {
            if (key === oldPath || key.startsWith(oldPath)) {
              const suffix = key.slice(oldPath.length);
              next[newPath + suffix] = next[key];
              delete next[key];
            }
          }
        } else {
          next[newPath] = next[oldPath];
          delete next[oldPath];
        }

        const updates: Partial<FsState> = { entries: next };
        if (openFile === oldPath) {
          updates.openFile = oldPath.endsWith("/") ? null : newPath;
        } else if (openFile && openFile.startsWith(oldPath)) {
          updates.openFile = newPath + openFile.slice(oldPath.length);
        }
        set(updates);
      },

      createFolder(path) {
        path = normalizePath(path);
        if (!path.endsWith("/")) path += "/";
        set((s) => ({ entries: { ...s.entries, [path]: null } }));
      },

      setOpenFile(path) {
        set({ openFile: path ? normalizePath(path) : null });
      },
    }),
    {
      name: "kaitai-fs",
      // Only persist entries and openFile, not actions
      partialize: (s) => ({ entries: s.entries, openFile: s.openFile }),
    }
  )
);

// ── Derived helpers (pure functions, not in store) ──

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
