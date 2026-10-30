import { requestUrl } from "obsidian";

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await requestUrl({
    url,
    throw: false,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; homewire)", ...headers },
  });
  if (res.status < 200 || res.status > 299) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetchText(url: string): Promise<string> {
  return (await get(url)).text;
}

export async function fetchJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  return (await get(url, headers)).json as T;
}
