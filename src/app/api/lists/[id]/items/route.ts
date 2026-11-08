import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { jsonError, notFound, parseBody } from "@/lib/api";
import { clearItems, createItem, getItems, getList } from "@/lib/repo";
import { clearScopeSchema, itemCreateSchema } from "@/lib/schema";

type Ctx = RouteContext<"/api/lists/[id]/items">;

export async function GET(_req: NextRequest, ctx: Ctx) {
  await connection();
  const { id } = await ctx.params;
  if (!getList(id)) return notFound("List not found");
  return Response.json(getItems(id));
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getList(id)) return notFound("List not found");
  const parsed = await parseBody(request, itemCreateSchema);
  if ("error" in parsed) return parsed.error;
  return Response.json(createItem(id, parsed.data), { status: 201 });
}

/** DELETE /api/lists/:id/items?scope=all|checked|sample */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getList(id)) return notFound("List not found");
  const scope = clearScopeSchema.safeParse(
    request.nextUrl.searchParams.get("scope") ?? "all",
  );
  if (!scope.success) return jsonError("scope must be all, checked or sample", 400);
  return Response.json({ deleted: clearItems(id, scope.data) });
}
