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
