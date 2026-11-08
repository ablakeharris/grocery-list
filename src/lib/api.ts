import * as z from "zod";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const notFound = (what = "Not found") => jsonError(what, 404);

/** Reads and validates a JSON body. Returns the data or an error Response. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.output<T> } | { error: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: jsonError(z.prettifyError(result.error), 400) };
  }
  return { data: result.data };
}
