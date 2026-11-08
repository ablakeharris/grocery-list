import * as z from "zod";
import { CATEGORIES } from "./categories";

const name = z.string().trim().min(1, "Name is required").max(100);
const quantity = z.int().min(1).max(999);
const priceCents = z.int().min(0).max(10_000_000).nullable();
const category = z.enum(CATEGORIES);

export const itemCreateSchema = z.object({
  name,
  quantity: quantity.default(1),
  priceCents: priceCents.default(null),
  category: category.default("Other"),
});

export const itemUpdateSchema = z
  .object({ name, quantity, priceCents, category, checked: z.boolean() })
  .partial();

export const listCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
});

export const listUpdateSchema = listCreateSchema;

export const clearScopeSchema = z.enum(["all", "checked", "sample"]);

export type ItemCreate = z.infer<typeof itemCreateSchema>;
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;
export type ClearScope = z.infer<typeof clearScopeSchema>;
