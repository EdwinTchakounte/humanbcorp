"use client";

import type { Profile } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8011";
const ACCESS = "hbc_access";
const REFRESH = "hbc_refresh";

export const tokens = {
  get access() {
    return typeof window !== "undefined" ? localStorage.getItem(ACCESS) : null;
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

async function refreshAccess(): Promise<boolean> {
  const refresh = localStorage.getItem(REFRESH);
  if (!refresh) return false;
  const res = await fetch(`${API}/api/v1/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  tokens.set(data.access);
  return true;
}

interface Opts {
  method?: string;
  body?: unknown;
  isForm?: boolean;
  retry?: boolean;
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, isForm = false, retry = true } = opts;
  const headers: Record<string, string> = {};
  const access = tokens.access;
  if (access) headers["Authorization"] = `Bearer ${access}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && retry && (await refreshAccess())) {
    return api<T>(path, { ...opts, retry: false });
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(username: string, password: string): Promise<Profile | null> {
  const res = await fetch(`${API}/api/v1/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  tokens.set(data.access, data.refresh);
  return (data.profile as Profile) ?? null;
}

/** Profil du compte connecté (rôle + modules). */
export async function me(): Promise<Profile | null> {
  try {
    return await api<Profile>("/auth/me/");
  } catch {
    return null;
  }
}

export function apiBase() {
  return API;
}

/** Télécharge un binaire protégé (ex. CV) en portant le jeton, puis déclenche
 *  l'enregistrement côté navigateur. L'URL média brute n'est pas exploitable
 *  directement : l'endpoint exige l'authentification. */
export async function downloadFile(path: string, filename?: string): Promise<void> {
  const access = tokens.access;
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Récupère une liste paginée DRF complète (suit réellement `next`).
 *
 * DRF renvoie `next` en URL absolue ; on la ramène à un chemin relatif à
 * `/api/v1` pour réutiliser `api()` (auth + refresh). Sans cette boucle, toute
 * liste de plus d'une page serveur était silencieusement tronquée. */
type Paged<T> = { results?: T[]; next?: string | null };

export async function listAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let nextPath: string | null = path;
  while (nextPath !== null) {
    const p: string = nextPath;
    const page = (await api<Paged<T> | T[]>(p)) as Paged<T> | T[];
    if (Array.isArray(page)) return page;
    out.push(...(page.results ?? []));
    const raw = page.next ?? null;
    if (raw === null) {
      nextPath = null;
    } else {
      const idx = raw.indexOf("/api/v1");
      nextPath = idx >= 0 ? raw.slice(idx + "/api/v1".length) : null;
    }
  }
  return out;
}
