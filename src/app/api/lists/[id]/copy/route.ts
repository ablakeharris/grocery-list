import { notFound } from "@/lib/api";
import { copyList } from "@/lib/repo";

export async function POST(_req: Request, ctx: RouteContext<"/api/lists/[id]/copy">) {
  const { id } = await ctx.params;
  const list = copyList(id);
  return list ? Response.json(list, { status: 201 }) : notFound("List not found");
}
