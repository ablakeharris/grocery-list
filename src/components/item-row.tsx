"use client";

import { Check, Trash2 } from "lucide-react";
import { formatCents, lineTotalCents } from "@/lib/format";
import type { ItemCreate } from "@/lib/schema";
import type { Item } from "@/lib/types";
import { IconButton } from "./icon-button";
import { ItemForm } from "./item-form";

type Props = {
  item: Item;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSave: (input: ItemCreate) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
};

export function ItemRow({
  item,
  editing,
  onToggle,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: Props) {
  const pending = item.id.startsWith("temp-");

  if (editing) {
    return (
      <li className="rounded-xl bg-soft p-3">
        <ItemForm
          initial={item}
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
      className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 transition hover:bg-soft/60 ${pending ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={`Mark ${item.name} as ${item.checked ? "not bought" : "bought"}`}
        disabled={pending}
        onClick={onToggle}
        className={`flex size-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition ${
          item.checked
            ? "border-accent bg-accent text-accent-ink"
            : "border-accent bg-card"
        }`}
      >
        {item.checked && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={onEdit}
        title="Edit item"
        className={`min-w-0 flex-1 truncate text-left text-[15px] ${
          item.checked ? "text-muted line-through decoration-muted/70" : "text-ink"
        }`}
      >
        {item.name}
      </button>

      {item.quantity > 1 && (
        <span className={`text-sm text-muted ${item.checked ? "line-through" : ""}`}>
          x{item.quantity}
        </span>
      )}

      {item.priceCents !== null && (
        <span
          className={`text-right text-sm whitespace-nowrap ${item.checked ? "opacity-60 line-through" : ""}`}
        >
          <span className="font-semibold">{formatCents(lineTotalCents(item))}</span>
          {item.quantity > 1 && (
            <span className="text-muted max-sm:hidden">
              {" "}
              ({formatCents(item.priceCents)} ea)
            </span>
          )}
        </span>
      )}

      <span className="rounded-md bg-soft px-2 py-1 text-xs font-medium whitespace-nowrap text-ink/80 max-sm:hidden print:hidden">
        {item.category}
      </span>

      <IconButton
        label={`Delete ${item.name}`}
        disabled={pending}
        onClick={onDelete}
        className="-mr-2 shrink-0 text-muted print:hidden"
      >
        <Trash2 aria-hidden className="size-4" />
      </IconButton>
    </li>
  );
}
