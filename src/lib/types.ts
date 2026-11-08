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
  /** Package size, e.g. "16 oz". Null when it doesn't matter. */
  size: string | null;
  quantity: number;
  /** Price for a single unit, in cents. Null when unknown. */
  priceCents: number | null;
  category: Category;
  checked: boolean;
  isSample: boolean;
  createdAt: string;
};

export type Meal = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MealSummary = Meal & {
  ingredientCount: number;
  /** Cost of one batch of the meal, from ingredients with a known price. */
  totalCents: number;
};

/** A grocery item a meal needs. Becomes a list item when the meal is added to a list. */
export type Ingredient = {
  id: string;
  mealId: string;
  name: string;
  /** Package size, e.g. "16 oz". Null when it doesn't matter. */
  size: string | null;
  quantity: number;
  /** Price for a single unit, in cents. Null when unknown. */
  priceCents: number | null;
  category: Category;
  createdAt: string;
};

/** What happened when a meal was added to a list. */
export type AddMealResult = {
  /** Ingredients that weren't on the list yet. */
  added: number;
  /** Ingredients already on the list (unchecked) whose quantity went up. */
  merged: number;
  items: Item[];
};

/**
 * A generic item from the catalog (many brands' products merged into one),
 * offered while typing an item name.
 */
export type FoodSuggestion = {
  name: string;
  /** Package sizes it's commonly sold in, smallest first, e.g. ["16 oz", "28 oz"]. */
  sizes: string[];
  /** Null when the catalog doesn't know which aisle it belongs in. */
  category: Category | null;
};
