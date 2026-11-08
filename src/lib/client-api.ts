import type { ClearScope, ItemCreate, ItemUpdate } from "./schema";
import type { Item, List, ListSummary } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? res.statusText, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const api = {
  lists: () => request<ListSummary[]>("/api/lists"),
  createList: (name: string) => request<List>("/api/lists", json("POST", { name })),
  renameList: (id: string, name: string) =>
    request<List>(`/api/lists/${id}`, json("PATCH", { name })),
  deleteList: (id: string) =>
    request<void>(`/api/lists/${id}`, { method: "DELETE" }),
  listWithItems: (id: string) =>
    request<{ list: List; items: Item[] }>(`/api/lists/${id}`),

  createItem: (listId: string, input: ItemCreate) =>
    request<Item>(`/api/lists/${listId}/items`, json("POST", input)),
  updateItem: (id: string, patch: ItemUpdate) =>
    request<Item>(`/api/items/${id}`, json("PATCH", patch)),
  deleteItem: (id: string) =>
    request<void>(`/api/items/${id}`, { method: "DELETE" }),
  clearItems: (listId: string, scope: ClearScope) =>
    request<{ deleted: number }>(`/api/lists/${listId}/items?scope=${scope}`, {
      method: "DELETE",
    }),
};
