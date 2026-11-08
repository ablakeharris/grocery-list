"use client";

import { Trash2 } from "lucide-react";
import { formatCents, lineTotalCents } from "@/lib/format";
import type { IngredientCreate } from "@/lib/schema";
import type { Ingredient } from "@/lib/types";
import { IconButton } from "./icon-button";
import { ItemForm } from "./item-form";

type Props = {
  ingredient: Ingredient;
  editing: boolean;
  onEdit: () => void;
  onSave: (input: IngredientCreate) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
};

export function IngredientRow({
  ingredient,
  editing,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: Props) {
  const pending = ingredient.id.startsWith("temp-");

  if (editing) {
    return (
      <li className="rounded-xl bg-soft p-3">
        <ItemForm
          initial={ingredient}
          submitLabel="Save"
          autoFocus
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  return (
    <li
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 transition hover:bg-soft/60 ${pending ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        disabled={pending}
        onClick={onEdit}
        title="Edit ingredient"
        className="min-w-0 flex-1 truncate text-left text-[15px] text-ink"
      >
        {ingredient.name}
      </button>

      {ingredient.quantity > 1 && (
        <span className="text-sm text-muted">x{ingredient.quantity}</span>
      )}

      {ingredient.priceCents !== null && (
        <span className="text-sm font-semibold whitespace-nowrap">
          {formatCents(lineTotalCents(ingredient))}
        </span>
      )}

      <span className="rounded-md bg-soft px-2 py-1 text-xs font-medium whitespace-nowrap text-ink/80 max-sm:hidden">
        {ingredient.category}
      </span>

      <IconButton
        label={`Remove ${ingredient.name}`}
        disabled={pending}
        onClick={onDelete}
        className="-mr-2 shrink-0 text-muted"
      >
        <Trash2 aria-hidden className="size-4" />
      </IconButton>
    </li>
  );
}
