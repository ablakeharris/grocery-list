"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CopyPlus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { formatCents, lineTotalCents } from "@/lib/format";
import type { IngredientCreate, IngredientUpdate } from "@/lib/schema";
import { groupByCategory } from "@/lib/share";
import type { Ingredient, Meal } from "@/lib/types";
import { IconButton } from "./icon-button";
import { IngredientRow } from "./ingredient-row";
import { fieldClass, ItemForm } from "./item-form";
import { useLiveRefresh } from "./use-live-refresh";
import { useToast } from "./toast";

type Props = { initialMeal: Meal; initialIngredients: Ingredient[] };

export function MealView({ initialMeal, initialIngredients }: Props) {
  const router = useRouter();
  const [meal, setMeal] = useState(initialMeal);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [gone, setGone] = useState(false);
  const [copying, setCopying] = useState(false);
  const { toast, showToast } = useToast();
  // Skip background refreshes while our own changes are in flight.
  const pending = useRef(0);

  async function refresh() {
    if (pending.current > 0) return;
    try {
      const data = await api.mealWithIngredients(meal.id);
      if (pending.current > 0) return;
      setMeal(data.meal);
      setIngredients(data.ingredients);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setGone(true);
    }
  }

  useLiveRefresh(refresh);

  async function mutate(
    optimistic: (prev: Ingredient[]) => Ingredient[],
    run: () => Promise<unknown>,
  ) {
    setIngredients(optimistic);
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

  function addIngredient(input: IngredientCreate) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const temp: Ingredient = {
      ...input,
      id: tempId,
      mealId: meal.id,
      createdAt: new Date().toISOString(),
    };
    void mutate(
      (prev) => [...prev, temp],
      async () => {
        const created = await api.createIngredient(meal.id, input);
        setIngredients((prev) => prev.map((i) => (i.id === tempId ? created : i)));
      },
    );
  }

  function updateIngredient(id: string, patch: IngredientUpdate) {
    void mutate(
      (prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      () => api.updateIngredient(id, patch),
    );
  }

  function deleteIngredient(id: string) {
    void mutate(
      (prev) => prev.filter((i) => i.id !== id),
      () => api.deleteIngredient(id),
    );
  }

  async function rename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    setRenaming(false);
    if (!name || name === meal.name) return;
    setMeal((m) => ({ ...m, name }));
    try {
      setMeal(await api.renameMeal(meal.id, name));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rename failed");
      void refresh();
    }
  }

  async function copy() {
    setCopying(true);
    try {
      const copied = await api.copyMeal(meal.id);
      router.push(`/meals/${copied.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't copy meal");
      setCopying(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the "${meal.name}" meal? Your lists stay as they are.`)) return;
    try {
      await api.deleteMeal(meal.id);
      router.push("/meals");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete meal");
    }
  }

  if (gone) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
        <p className="font-medium">This meal was deleted.</p>
        <Link href="/meals" className="mt-4 inline-block text-sm font-semibold text-accent">
          Back to all meals
        </Link>
      </div>
    );
  }

  const total = ingredients.reduce((sum, i) => sum + lineTotalCents(i), 0);
  const groups = groupByCategory(ingredients);

  return (
    <>
      <Link
        href="/meals"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> All meals
      </Link>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6">
        <header className="flex items-start justify-between gap-3">
          {renaming ? (
            <form onSubmit={rename} className="flex-1">
              <input
                name="name"
                defaultValue={meal.name}
                aria-label="Meal name"
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
              title="Rename meal"
            >
              <h1 className="truncate text-xl font-semibold">{meal.name}</h1>
              <Pencil
                aria-hidden
                className="size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100"
              />
            </button>
          )}
          <div className="flex shrink-0 gap-0.5">
            <IconButton label="Make a copy" onClick={copy} disabled={copying}>
              <CopyPlus aria-hidden className="size-[18px]" />
            </IconButton>
            <IconButton label="Delete meal" onClick={remove}>
              <Trash2 aria-hidden className="size-[18px]" />
            </IconButton>
          </div>
        </header>

        {total > 0 && (
          <p className="mt-2 text-[15px] font-semibold">Est. cost: {formatCents(total)}</p>
        )}

        <div className="my-4 border-t border-line" />

        <ItemForm onSubmit={addIngredient} placeholder="Add an ingredient..." />

        {groups.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            No ingredients yet. Add what you need to buy for this meal.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {groups.map((group) => (
              <section key={group.category} aria-label={group.category}>
                <h2 className="mb-1 px-3 text-xs font-semibold tracking-wider text-muted uppercase">
                  {group.category}
                </h2>
                <ul>
                  {group.items.map((ingredient) => (
                    <IngredientRow
                      key={ingredient.id}
                      ingredient={ingredient}
                      editing={editingId === ingredient.id}
                      onEdit={() => setEditingId(ingredient.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(input) => {
                        setEditingId(null);
                        updateIngredient(ingredient.id, input);
                      }}
                      onDelete={() => deleteIngredient(ingredient.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {toast}
    </>
  );
}
