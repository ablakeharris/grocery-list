"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { api } from "@/lib/client-api";
import { productLabel, tidyBrand } from "@/lib/format";
import type { FoodSuggestion } from "@/lib/types";

const DEBOUNCE_MS = 150;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick: (product: FoodSuggestion) => void;
  className: string;
  autoFocus?: boolean;
  placeholder?: string;
};

/** Item name field that suggests products from the food catalog as you type. */
export function FoodNameInput({
  value,
  onChange,
  onPick,
  className,
  autoFocus,
  placeholder = "Add an item...",
}: Props) {
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<AbortController>(null);
  const listId = useId();

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      inflight.current?.abort();
    },
    [],
  );

  function close() {
    clearTimeout(timer.current);
    inflight.current?.abort();
    setOpen(false);
    setActive(-1);
  }

  function search(text: string) {
    clearTimeout(timer.current);
    inflight.current?.abort();
    if (text.trim().length < 2) {
      close();
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      inflight.current = controller;
      try {
        const results = await api.searchFoods(text, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setActive(-1);
        setOpen(results.length > 0);
      } catch {
        // Suggestions are a convenience; typing still works without them.
      }
    }, DEBOUNCE_MS);
  }

  function pick(product: FoodSuggestion) {
    close();
    onPick(product);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycle through -1 (back to the typed text) and each suggestion.
      const slots = suggestions.length + 1;
      setActive((i) => ((i + 1 + step + slots) % slots) - 1);
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault();
        pick(suggestions[active]);
      } else {
        close(); // Submit what was typed.
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        className={`${className} w-full`}
        placeholder={placeholder}
        aria-label="Item name"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        maxLength={100}
        autoFocus={autoFocus}
        enterKeyHint="done"
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggested products"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-lg"
        >
          {suggestions.map((product, i) => {
            const details = [product.brand && tidyBrand(product.brand), product.quantity]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={product.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Keep focus in the input so blur doesn't close the list first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(product)}
                onMouseEnter={() => setActive(i)}
                title={productLabel(product)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? "bg-soft" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ink">{product.name}</span>
                  {details && <span className="block truncate text-xs text-muted">{details}</span>}
                </span>
                {product.category && (
                  <span className="shrink-0 rounded-md bg-soft px-2 py-0.5 text-xs font-medium text-ink/70 max-sm:hidden">
                    {product.category}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
