type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

let accessToken: string | null = null;

export function setApiToken(token: string | null) {
  accessToken = token;
}

export async function apiUpload(path: string, file: File): Promise<{ assetId: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    const err = await safeJson(res);
    const message = err?.error || `Upload failed (${res.status})`;
    throw new Error(message);
  }

  const data = await safeJson(res);
  return data?.data as { assetId: string };
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await safeJson(res);
    const message = err?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return (await safeJson(res)) as T;
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
