"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/client-api";
import type { MealSummary } from "@/lib/types";
import { IconButton } from "./icon-button";
import { ingredientCountText } from "./meals-view";

type Props = {
  onAdd: (meal: MealSummary) => void;
  onClose: () => void;
};

/** Panel on a list page for adding a saved meal's ingredients to the list. */
export function MealPicker({ onAdd, onClose }: Props) {
  const [meals, setMeals] = useState<MealSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.meals().then(
      (m) => !cancelled && setMeals(m),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-4 rounded-2xl bg-soft p-3 print:hidden">
      <div className="flex items-center justify-between gap-2 pl-1">
        <h2 className="text-sm font-semibold">Add a meal&apos;s ingredients</h2>
        <IconButton label="Close" onClick={onClose} className="size-8">
          <X aria-hidden className="size-4" />
        </IconButton>
      </div>

      {failed ? (
        <p className="px-1 py-4 text-sm text-muted">Couldn&apos;t load meals.</p>
      ) : meals === null ? (
        <p className="px-1 py-4 text-sm text-muted">Loading…</p>
      ) : meals.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">
          No meals saved yet.{" "}
          <Link href="/meals" className="font-semibold text-accent">
            Create one
          </Link>
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {meals.map((meal) => (
            <li key={meal.id} className="flex items-center gap-3 rounded-lg px-1 py-1">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{meal.name}</p>
                <p className="text-xs text-muted">{ingredientCountText(meal.ingredientCount)}</p>
              </div>
              <button
                type="button"
                disabled={meal.ingredientCount === 0}
                onClick={() => onAdd(meal)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-sm font-semibold text-ink shadow-sm transition hover:brightness-95 disabled:opacity-50"
              >
                <Plus aria-hidden className="size-3.5" strokeWidth={2.5} /> Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {meals && meals.length > 0 && (
        <p className="mt-2 px-1 text-xs text-muted">
          Items already on the list get their quantity bumped. Add a meal twice to double it.
        </p>
      )}
    </div>
  );
}
