import { connection } from "next/server";
import { parseBody } from "@/lib/api";
import { createMeal, getMealSummaries } from "@/lib/repo";
import { mealCreateSchema } from "@/lib/schema";

export async function GET() {
  await connection();
  return Response.json(getMealSummaries());
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, mealCreateSchema);
  if ("error" in parsed) return parsed.error;
  return Response.json(createMeal(parsed.data.name), { status: 201 });
}
