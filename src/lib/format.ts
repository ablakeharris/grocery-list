const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** Parses a dollar string like "2.49" or "$2.49" into cents. Empty → null. */
export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

export function lineTotalCents(item: {
  quantity: number;
  priceCents: number | null;
}): number {
  return (item.priceCents ?? 0) * item.quantity;
}
