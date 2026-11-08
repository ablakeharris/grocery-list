import Link from "next/link";
import { ShoppingCart, UtensilsCrossed } from "lucide-react";

const TABS = [
  { href: "/", label: "Lists", Icon: ShoppingCart },
  { href: "/meals", label: "Meals", Icon: UtensilsCrossed },
] as const;

export function SectionTabs({ active }: { active: "/" | "/meals" }) {
  return (
    <nav aria-label="Sections" className="mb-3 flex gap-1 print:hidden">
      {TABS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === active ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            href === active ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <Icon aria-hidden className="size-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}
