"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChevronRight, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/client-api";
import { formatCents } from "@/lib/format";
import type { MealSummary } from "@/lib/types";
import { IconButton } from "./icon-button";
import { fieldClass } from "./item-form";
import { useLiveRefresh } from "./use-live-refresh";
import { useToast } from "./toast";

export function MealsView({ initialMeals }: { initialMeals: MealSummary[] }) {
  const router = useRouter();
  const [meals, setMeals] = useState(initialMeals);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast, showToast } = useToast();

  useLiveRefresh(() => {
    api.meals().then(setMeals, () => {});
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const meal = await api.createMeal(trimmed);
      router.push(`/meals/${meal.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create meal");
      setCreating(false);
    }
  }

  async function remove(meal: MealSummary) {
    if (!confirm(`Delete the "${meal.name}" meal? Your lists stay as they are.`)) return;
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));
    try {
      await api.deleteMeal(meal.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete meal");
      api.meals().then(setMeals, () => {});
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <UtensilsCrossed aria-hidden className="size-5 text-accent" /> Meals
      </h1>
      <p className="mt-1 text-sm text-muted">
        Save the ingredients for meals you make often, then add them to a list in one tap.
      </p>

      <form onSubmit={create} className="mt-4 flex gap-2">
        <input
          className={`${fieldClass} min-w-0 flex-1`}
          placeholder="New meal, e.g. Taco night"
          aria-label="New meal name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          <Plus aria-hidden className="size-4" strokeWidth={2.5} /> New meal
        </button>
      </form>

      <div className="my-4 border-t border-line" />

      {meals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No meals yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-1">
          {meals.map((meal) => (
            <li key={meal.id} className="flex items-center gap-1 rounded-xl hover:bg-soft/70">
              <Link
                href={`/meals/${meal.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{meal.name}</p>
                  <p className="text-sm text-muted">
                    {ingredientCountText(meal.ingredientCount)}
                    {meal.totalCents > 0 && ` · ${formatCents(meal.totalCents)}`}
                  </p>
                </div>
                <ChevronRight aria-hidden className="size-4 text-muted" />
              </Link>
              <IconButton
                label={`Delete ${meal.name}`}
                onClick={() => remove(meal)}
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

export function ingredientCountText(count: number) {
  if (count === 0) return "No ingredients";
  return `${count} ${count === 1 ? "ingredient" : "ingredients"}`;
}
