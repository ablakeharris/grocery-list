import { connection } from "next/server";
import { notFound, parseBody } from "@/lib/api";
import { deleteList, getItems, getList, renameList } from "@/lib/repo";
import { listUpdateSchema } from "@/lib/schema";

export async function GET(_req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const list = getList(id);
  if (!list) return notFound("List not found");
  return Response.json({ list, items: getItems(id) });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/lists/[id]">,
) {
  const { id } = await ctx.params;
  const parsed = await parseBody(request, listUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const list = renameList(id, parsed.data.name);
  return list ? Response.json(list) : notFound("List not found");
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/lists/[id]">,
) {
  const { id } = await ctx.params;
  return deleteList(id)
    ? new Response(null, { status: 204 })
    : notFound("List not found");
}
