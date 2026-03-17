const STORAGE_KEY = "kaitai-ksy-files";

export interface KsyFile {
  name: string;
  content: string;
}

export function loadKsyFiles(): KsyFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KsyFile[];
  } catch {
    return [];
  }
}

export function saveKsyFiles(files: KsyFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function addKsyFile(file: KsyFile): KsyFile[] {
  const files = loadKsyFiles();
  const idx = files.findIndex((f) => f.name === file.name);
  if (idx >= 0) {
    files[idx] = file;
  } else {
    files.push(file);
  }
  saveKsyFiles(files);
  return files;
}

export function removeKsyFile(name: string): KsyFile[] {
  const files = loadKsyFiles().filter((f) => f.name !== name);
  saveKsyFiles(files);
  return files;
}
