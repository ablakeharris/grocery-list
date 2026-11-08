"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { CATEGORIES, DEFAULT_CATEGORY, type Category } from "@/lib/categories";
import { centsToInput, parseDollars, productLabel } from "@/lib/format";
import type { ItemCreate } from "@/lib/schema";
import { FoodNameInput } from "./food-name-input";

export const fieldClass =
  "h-10 rounded-lg border border-line bg-card px-3 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

type Props = {
  initial?: ItemCreate;
  submitLabel?: string;
  autoFocus?: boolean;
  placeholder?: string;
  onSubmit: (input: ItemCreate) => void;
  onCancel?: () => void;
};

export function ItemForm({
  initial,
  submitLabel = "Add",
  autoFocus,
  placeholder,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [price, setPrice] = useState(centsToInput(initial?.priceCents ?? null));
  const [category, setCategory] = useState<Category>(
    initial?.category ?? DEFAULT_CATEGORY,
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = initial !== undefined;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter an item name");
      return;
    }
    const qty = Math.min(999, Math.max(1, Math.round(Number(quantity) || 1)));
    const priceCents = parseDollars(price);
    if (price.trim() !== "" && priceCents === null) {
      setError("Price must be a number, like 2.49");
      return;
    }
    setError(null);
    onSubmit({ name: trimmed, quantity: qty, priceCents, category });
    if (!isEdit) {
      // Keep the category: people tend to add several items from the same aisle.
      setName("");
      setQuantity("1");
      setPrice("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <FoodNameInput
        className={fieldClass}
        value={name}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={setName}
        onPick={(product) => {
          setName(productLabel(product));
          if (product.category) setCategory(product.category);
          setError(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <input
          className={`${fieldClass} w-16`}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          aria-label="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <div className="relative w-28">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            $
          </span>
          <input
            className={`${fieldClass} w-full pl-6`}
            type="text"
            inputMode="decimal"
            placeholder="Price"
            aria-label="Price each"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="relative min-w-32 flex-1">
          <select
            className={`${fieldClass} w-full appearance-none pr-9`}
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
          />
        </div>
        <div className="flex gap-2 max-sm:w-full">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:bg-soft max-sm:flex-1"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition hover:brightness-110 active:brightness-95 max-sm:flex-1"
          >
            {!isEdit && <Plus aria-hidden className="size-4" strokeWidth={2.5} />}
            {submitLabel}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </form>
  );
}
