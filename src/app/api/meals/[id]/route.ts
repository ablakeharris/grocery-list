import { connection } from "next/server";
import { notFound, parseBody } from "@/lib/api";
import { deleteMeal, getIngredients, getMeal, renameMeal } from "@/lib/repo";
import { mealUpdateSchema } from "@/lib/schema";

type Ctx = RouteContext<"/api/meals/[id]">;

export async function GET(_req: Request, ctx: Ctx) {
  await connection();
  const { id } = await ctx.params;
  const meal = getMeal(id);
  if (!meal) return notFound("Meal not found");
  return Response.json({ meal, ingredients: getIngredients(id) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, mealUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const meal = renameMeal(id, parsed.data.name);
  return meal ? Response.json(meal) : notFound("Meal not found");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return deleteMeal(id)
    ? new Response(null, { status: 204 })
    : notFound("Meal not found");
}
