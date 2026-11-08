import { connection } from "next/server";
import { parseBody } from "@/lib/api";
import { createList, getListSummaries } from "@/lib/repo";
import { listCreateSchema } from "@/lib/schema";

export async function GET() {
  await connection();
  return Response.json(getListSummaries());
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, listCreateSchema);
  if ("error" in parsed) return parsed.error;
  return Response.json(createList(parsed.data.name), { status: 201 });
}
