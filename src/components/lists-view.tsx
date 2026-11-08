"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChevronRight, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { formatCents } from "@/lib/format";
import type { ListSummary } from "@/lib/types";
import { IconButton } from "./icon-button";
import { fieldClass } from "./item-form";
import { useLiveRefresh } from "./use-live-refresh";
import { useToast } from "./toast";

export function ListsView({ initialLists }: { initialLists: ListSummary[] }) {
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast, showToast } = useToast();

  useLiveRefresh(() => {
    api.lists().then(setLists, () => {});
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const list = await api.createList(trimmed);
      router.push(`/lists/${list.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create list");
      setCreating(false);
    }
  }

  async function remove(list: ListSummary) {
    const detail = list.itemCount ? ` and its ${list.itemCount} items` : "";
    if (!confirm(`Delete "${list.name}"${detail}? This can't be undone.`)) return;
    setLists((prev) => prev.filter((l) => l.id !== list.id));
    try {
      await api.deleteList(list.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete list");
      api.lists().then(setLists, () => {});
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <ShoppingCart aria-hidden className="size-5 text-accent" /> Grocery Lists
      </h1>

      <form onSubmit={create} className="mt-4 flex gap-2">
        <input
          className={`${fieldClass} min-w-0 flex-1`}
          placeholder="New list name, e.g. Costco run"
          aria-label="New list name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          <Plus aria-hidden className="size-4" strokeWidth={2.5} /> New list
        </button>
      </form>

      <div className="my-4 border-t border-line" />

      {lists.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No lists yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-1">
          {lists.map((list) => (
            <li key={list.id} className="flex items-center gap-1 rounded-xl hover:bg-soft/70">
              <Link
                href={`/lists/${list.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{list.name}</p>
                  <p className="text-sm text-muted">
                    {list.itemCount === 0
                      ? "Empty"
                      : `${list.checkedCount}/${list.itemCount} checked`}
                    {list.totalCents > 0 && ` · ${formatCents(list.totalCents)}`}
                  </p>
                </div>
                <ChevronRight aria-hidden className="size-4 text-muted" />
              </Link>
              <IconButton
                label={`Delete ${list.name}`}
                onClick={() => remove(list)}
                className="mr-1 text-muted"
              >
                <Trash2 aria-hidden className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {toast}
    </section>
  );
}
