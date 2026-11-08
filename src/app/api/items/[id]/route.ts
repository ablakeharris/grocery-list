import { notFound, parseBody } from "@/lib/api";
import { deleteItem, updateItem } from "@/lib/repo";
import { itemUpdateSchema } from "@/lib/schema";

type Ctx = RouteContext<"/api/items/[id]">;

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, itemUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const item = updateItem(id, parsed.data);
  return item ? Response.json(item) : notFound("Item not found");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return deleteItem(id)
    ? new Response(null, { status: 204 })
    : notFound("Item not found");
}
