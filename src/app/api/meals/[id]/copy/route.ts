import { notFound } from "@/lib/api";
import { copyMeal } from "@/lib/repo";

export async function POST(_req: Request, ctx: RouteContext<"/api/meals/[id]/copy">) {
  const { id } = await ctx.params;
  const meal = copyMeal(id);
  return meal ? Response.json(meal, { status: 201 }) : notFound("Meal not found");
}
