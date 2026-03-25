import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

/** List all file paths on the server. */
export async function listFiles(): Promise<string[]> {
  const res = await api.get<{ files: string[] }>("/files");
  return res.data.files;
}

/** Get a single file's content. Returns null if 404. */
export async function getFile(path: string): Promise<string | null> {
  try {
    const res = await api.get<{ path: string; content: string }>(
      `/files${path}`
    );
    return res.data.content;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

/** Create or overwrite a file. */
export async function putFile(path: string, content: string): Promise<void> {
  await api.put(`/files${path}`, { content });
}

/** Delete a file. */
export async function deleteFile(path: string): Promise<void> {
  await api.delete(`/files${path}`);
}
