import { notFound, parseBody } from "@/lib/api";
import { addMealToList, getList } from "@/lib/repo";
import { addMealSchema } from "@/lib/schema";

/** POST /api/lists/:id/meals { mealId, times? } — adds a meal's ingredients to the list. */
export async function POST(request: Request, ctx: RouteContext<"/api/lists/[id]/meals">) {
  const { id } = await ctx.params;
  if (!getList(id)) return notFound("List not found");
  const parsed = await parseBody(request, addMealSchema);
  if ("error" in parsed) return parsed.error;
  const result = addMealToList(id, parsed.data.mealId, parsed.data.times);
  return result ? Response.json(result) : notFound("Meal not found");
}
