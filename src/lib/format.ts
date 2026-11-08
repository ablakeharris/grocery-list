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

const COMPANY_SUFFIX = /[\s,]+(inc|llc|ltd|co|corp|corporation|company|companies|brands)\.?$/i;

/** "DAVE'S KILLER BREAD" -> "Dave's Killer Bread"; "Costco Companies Inc." -> "Costco". */
export function tidyBrand(brand: string): string {
  let b = brand.trim();
  while (COMPANY_SUFFIX.test(b)) b = b.replace(COMPANY_SUFFIX, "");
  // All caps or all lowercase: capitalize each word.
  if ((b === b.toUpperCase() && /[A-Z]{2}/.test(b)) || b === b.toLowerCase()) {
    b = b.toLowerCase().replace(/(^|[\s\-&])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
  }
  return b || brand.trim();
}

/** The item name to use for a catalog product, e.g. "Jif Creamy Peanut Butter". */
export function productLabel(product: { name: string; brand: string | null }): string {
  const brand = product.brand ? tidyBrand(product.brand) : "";
  const label =
    brand && !product.name.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${product.name}`
      : product.name;
  return label.slice(0, 100).trim();
}
