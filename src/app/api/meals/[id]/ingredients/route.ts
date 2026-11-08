import { notFound, parseBody } from "@/lib/api";
import { createIngredient, getMeal } from "@/lib/repo";
import { ingredientCreateSchema } from "@/lib/schema";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/meals/[id]/ingredients">,
) {
  const { id } = await ctx.params;
  if (!getMeal(id)) return notFound("Meal not found");
  const parsed = await parseBody(request, ingredientCreateSchema);
  if ("error" in parsed) return parsed.error;
  return Response.json(createIngredient(id, parsed.data), { status: 201 });
}
