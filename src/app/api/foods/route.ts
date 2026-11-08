import type { NextRequest } from "next/server";
import { searchFoods } from "@/lib/foods";

/** GET /api/foods?q=peanut+butter — product suggestions for the item name field. */
export function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  return Response.json(searchFoods(q));
}
