import type { Category } from "./categories";

export type List = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ListSummary = List & {
  itemCount: number;
  checkedCount: number;
  totalCents: number;
};

export type Item = {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  /** Price for a single unit, in cents. Null when unknown. */
  priceCents: number | null;
  category: Category;
  checked: boolean;
  isSample: boolean;
  createdAt: string;
};

/** A product from the Open Food Facts catalog, offered while typing an item name. */
export type FoodSuggestion = {
  /** Barcode. */
  code: string;
  name: string;
  brand: string | null;
  /** Package size as printed, e.g. "16 oz". */
  quantity: string | null;
  /** Null when the catalog doesn't know which aisle it belongs in. */
  category: Category | null;
};
