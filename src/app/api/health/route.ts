import { connection } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    getDb().prepare("SELECT 1").get();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 503 });
  }
}
