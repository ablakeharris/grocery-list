import type { ComponentProps } from "react";

type Props = ComponentProps<"button"> & { label: string };

export function IconButton({ label, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink/80 transition hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
