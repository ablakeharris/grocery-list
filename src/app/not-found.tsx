import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
      <p className="font-medium">That list doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-accent">
        Back to all lists
      </Link>
    </div>
  );
}
