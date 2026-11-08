import { CATEGORIES, type Category } from "./categories";
import { formatCents, lineTotalCents } from "./format";
import type { Item } from "./types";

export function groupByCategory<T extends { category: Category }>(items: T[]) {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}

export function listToText(name: string, items: Item[]): string {
  const lines = [name];
  for (const group of groupByCategory(items)) {
    lines.push("", group.category.toUpperCase());
    for (const item of group.items) {
      const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
      const box = item.checked ? "[x]" : "[ ]";
      const size = item.size ? ` (${item.size})` : "";
      lines.push(`${box} ${item.name}${size}${qty}`);
    }
  }
  const total = items.reduce((sum, i) => sum + lineTotalCents(i), 0);
  if (total > 0) lines.push("", `Est. total: ${formatCents(total)}`);
  return lines.join("\n");
}

/**
 * Shares via the OS share sheet when available, otherwise copies to the clipboard.
 * Both modern APIs need HTTPS, so on a plain-HTTP LAN address we fall back to
 * the old execCommand copy.
 */
export async function shareText(title: string, text: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      // fall through
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok ? "copied" : "failed";
}

/**
 * Link that opens the Messages app with the text filled in.
 * "?&body=" works on both iPhone (which wants "&") and Android (which wants "?").
 */
export function smsLink(phone: string, text: string): string {
  return `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(text)}`;
}

/** Link that opens the email app with the subject and body filled in. */
export function mailtoLink(email: string, subject: string, text: string): string {
  const body = text.replace(/\n/g, "\r\n");
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
