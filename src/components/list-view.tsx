"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Printer, Share2, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { formatCents, lineTotalCents } from "@/lib/format";
import type { ItemCreate, ItemUpdate } from "@/lib/schema";
import { groupByCategory, listToText, shareText } from "@/lib/share";
import type { Item, List } from "@/lib/types";
import { IconButton } from "./icon-button";
import { fieldClass, ItemForm } from "./item-form";
import { ItemRow } from "./item-row";
import { useLiveRefresh } from "./use-live-refresh";
import { useToast } from "./toast";

type Props = { initialList: List; initialItems: Item[] };

export function ListView({ initialList, initialItems }: Props) {
  const [list, setList] = useState(initialList);
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [gone, setGone] = useState(false);
  const { toast, showToast } = useToast();
  // Skip background refreshes while our own changes are in flight,
  // so the server's older copy doesn't overwrite the optimistic update.
  const pending = useRef(0);

  async function refresh() {
    if (pending.current > 0) return;
    try {
      const data = await api.listWithItems(list.id);
      if (pending.current > 0) return;
      setList(data.list);
      setItems(data.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setGone(true);
    }
  }

  useLiveRefresh(refresh);

  /** Applies an optimistic change, runs the request, and resyncs if it fails. */
  async function mutate(optimistic: (prev: Item[]) => Item[], run: () => Promise<unknown>) {
    setItems(optimistic);
    pending.current++;
    try {
      await run();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      pending.current--;
    }
    if (pending.current === 0) void refresh();
  }

  function addItem(input: ItemCreate) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const temp: Item = {
      ...input,
      id: tempId,
      listId: list.id,
      checked: false,
      isSample: false,
      createdAt: new Date().toISOString(),
    };
    void mutate(
      (prev) => [...prev, temp],
      async () => {
        const created = await api.createItem(list.id, input);
        setItems((prev) => prev.map((i) => (i.id === tempId ? created : i)));
      },
    );
  }

  function updateItem(id: string, patch: ItemUpdate) {
    void mutate(
      (prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      () => api.updateItem(id, patch),
    );
  }

  function deleteItem(id: string) {
    void mutate(
      (prev) => prev.filter((i) => i.id !== id),
      () => api.deleteItem(id),
    );
  }

  function clear(scope: "all" | "checked" | "sample") {
    const keep: Record<typeof scope, (i: Item) => boolean> = {
      all: () => false,
      checked: (i) => !i.checked,
      sample: (i) => !i.isSample,
    };
    void mutate(
      (prev) => prev.filter(keep[scope]),
      () => api.clearItems(list.id, scope),
    );
  }

  function clearAll() {
    if (items.length === 0) return;
    if (confirm(`Remove all ${items.length} items from "${list.name}"?`)) clear("all");
  }

  async function rename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    setRenaming(false);
    if (!name || name === list.name) return;
    setList((l) => ({ ...l, name }));
    try {
      setList(await api.renameList(list.id, name));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rename failed");
      void refresh();
    }
  }

  async function share() {
    const result = await shareText(list.name, listToText(list.name, items));
    if (result === "copied") showToast("List copied to clipboard");
    if (result === "failed") showToast("Couldn't share or copy the list");
  }

  if (gone) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
        <p className="font-medium">This list was deleted.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-accent">
          Back to all lists
        </Link>
      </div>
    );
  }

  const total = items.reduce((sum, i) => sum + lineTotalCents(i), 0);
  const remaining = items
    .filter((i) => !i.checked)
    .reduce((sum, i) => sum + lineTotalCents(i), 0);
  const checkedCount = items.filter((i) => i.checked).length;
  const hasSample = items.some((i) => i.isSample);
  const groups = groupByCategory(items);

  return (
    <>
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink print:hidden"
      >
        <ArrowLeft aria-hidden className="size-4" /> All lists
      </Link>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6 print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-3">
          {renaming ? (
            <form onSubmit={rename} className="flex-1">
              <input
                name="name"
                defaultValue={list.name}
                aria-label="List name"
                maxLength={60}
                autoFocus
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                className={`${fieldClass} w-full text-lg font-semibold`}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="group flex min-w-0 items-center gap-2 text-left"
              title="Rename list"
            >
              <h1 className="truncate text-xl font-semibold">{list.name}</h1>
              <Pencil
                aria-hidden
                className="size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100 print:hidden"
              />
            </button>
          )}
          <div className="flex shrink-0 gap-0.5 print:hidden">
            <IconButton label="Share list" onClick={share}>
              <Share2 aria-hidden className="size-[18px]" />
            </IconButton>
            <IconButton label="Print list" onClick={() => window.print()}>
              <Printer aria-hidden className="size-[18px]" />
            </IconButton>
            <IconButton label="Clear all items" onClick={clearAll} disabled={items.length === 0}>
              <Trash2 aria-hidden className="size-[18px]" />
            </IconButton>
          </div>
        </header>

        <p className="mt-2 text-[15px] font-semibold">
          Est. total: {formatCents(total)}
          {checkedCount > 0 && remaining !== total && (
            <span className="font-normal text-muted"> · {formatCents(remaining)} left to get</span>
          )}
        </p>

        <div className="my-4 border-t border-line" />

        <div className="print:hidden">
          <ItemForm onSubmit={addItem} />
        </div>

        {hasSample && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-soft px-4 py-2.5 text-sm print:hidden">
            <p>
              <span className="font-semibold">This is a sample list</span>
              <span className="text-muted"> — clear it and build your own.</span>
            </p>
            <button
              type="button"
              onClick={() => clear("sample")}
              className="shrink-0 rounded-full px-3 py-1.5 font-medium text-ink/80 hover:bg-card"
            >
              Clear sample
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            Nothing on this list yet. Add your first item above.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {groups.map((group) => (
              <section key={group.category} aria-label={group.category}>
                <h2 className="mb-1 px-3 text-xs font-semibold tracking-wider text-muted uppercase">
                  {group.category}
                </h2>
                <ul>
                  {group.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      onToggle={() => updateItem(item.id, { checked: !item.checked })}
                      onEdit={() => setEditingId(item.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(input) => {
                        setEditingId(null);
                        updateItem(item.id, input);
                      }}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {checkedCount > 0 && (
          <div className="mt-4 flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => clear("checked")}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-soft hover:text-ink"
            >
              Remove {checkedCount} checked {checkedCount === 1 ? "item" : "items"}
            </button>
          </div>
        )}
      </section>

      {toast}
    </>
  );
}
