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
