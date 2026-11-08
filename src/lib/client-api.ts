import type {
  ClearScope,
  IngredientCreate,
  IngredientUpdate,
  ItemCreate,
  ItemUpdate,
} from "./schema";
import type {
  AddMealResult,
  FoodSuggestion,
  Ingredient,
  Item,
  List,
  ListSummary,
  Meal,
  MealSummary,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? res.statusText, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const api = {
  lists: () => request<ListSummary[]>("/api/lists"),
  createList: (name: string) => request<List>("/api/lists", json("POST", { name })),
  renameList: (id: string, name: string) =>
    request<List>(`/api/lists/${id}`, json("PATCH", { name })),
  deleteList: (id: string) =>
    request<void>(`/api/lists/${id}`, { method: "DELETE" }),
  copyList: (id: string) => request<List>(`/api/lists/${id}/copy`, { method: "POST" }),
  listWithItems: (id: string) =>
    request<{ list: List; items: Item[] }>(`/api/lists/${id}`),

  createItem: (listId: string, input: ItemCreate) =>
    request<Item>(`/api/lists/${listId}/items`, json("POST", input)),
  updateItem: (id: string, patch: ItemUpdate) =>
    request<Item>(`/api/items/${id}`, json("PATCH", patch)),
  deleteItem: (id: string) =>
    request<void>(`/api/items/${id}`, { method: "DELETE" }),
  clearItems: (listId: string, scope: ClearScope) =>
    request<{ deleted: number }>(`/api/lists/${listId}/items?scope=${scope}`, {
      method: "DELETE",
    }),

  meals: () => request<MealSummary[]>("/api/meals"),
  createMeal: (name: string) => request<Meal>("/api/meals", json("POST", { name })),
  renameMeal: (id: string, name: string) =>
    request<Meal>(`/api/meals/${id}`, json("PATCH", { name })),
  deleteMeal: (id: string) =>
    request<void>(`/api/meals/${id}`, { method: "DELETE" }),
  copyMeal: (id: string) => request<Meal>(`/api/meals/${id}/copy`, { method: "POST" }),
  mealWithIngredients: (id: string) =>
    request<{ meal: Meal; ingredients: Ingredient[] }>(`/api/meals/${id}`),

  createIngredient: (mealId: string, input: IngredientCreate) =>
    request<Ingredient>(`/api/meals/${mealId}/ingredients`, json("POST", input)),
  updateIngredient: (id: string, patch: IngredientUpdate) =>
    request<Ingredient>(`/api/ingredients/${id}`, json("PATCH", patch)),
  deleteIngredient: (id: string) =>
    request<void>(`/api/ingredients/${id}`, { method: "DELETE" }),

  addMealToList: (listId: string, mealId: string, times = 1) =>
    request<AddMealResult>(`/api/lists/${listId}/meals`, json("POST", { mealId, times })),

  searchFoods: (q: string, signal?: AbortSignal) =>
    request<FoodSuggestion[]>(`/api/foods?q=${encodeURIComponent(q)}`, { signal }),
};
