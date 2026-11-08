import { notFound, parseBody } from "@/lib/api";
import { deleteIngredient, updateIngredient } from "@/lib/repo";
import { ingredientUpdateSchema } from "@/lib/schema";

type Ctx = RouteContext<"/api/ingredients/[id]">;

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, ingredientUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const ingredient = updateIngredient(id, parsed.data);
  return ingredient ? Response.json(ingredient) : notFound("Ingredient not found");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return deleteIngredient(id)
    ? new Response(null, { status: 204 })
    : notFound("Ingredient not found");
}
