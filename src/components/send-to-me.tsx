"use client";

import { useState } from "react";
import { Mail, MessageSquare, X } from "lucide-react";
import { mailtoLink, smsLink } from "@/lib/share";
import { IconButton } from "./icon-button";
import { fieldClass } from "./item-form";

type Props = {
  listName: string;
  text: string;
  onClose: () => void;
};

const PHONE_KEY = "send-to-me:phone";
const EMAIL_KEY = "send-to-me:email";

// The number and email are kept on this device only, since the app has no accounts.
function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value.trim());
  } catch {
    // private mode or blocked storage: the link still works, it just isn't remembered
  }
}

const buttonClass =
  "inline-flex h-10 w-32 shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110 aria-disabled:pointer-events-none aria-disabled:opacity-50";

/** Panel on a list page for texting or emailing the list to yourself. */
export function SendToMe({ listName, text, onClose }: Props) {
  // Only mounted after a tap, so reading storage here can't cause a hydration mismatch.
  const [phone, setPhone] = useState(() => load(PHONE_KEY));
  const [email, setEmail] = useState(() => load(EMAIL_KEY));

  const hasPhone = /\d{3,}/.test(phone.replace(/\D/g, ""));
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="mt-4 rounded-2xl bg-soft p-3 print:hidden">
      <div className="flex items-center justify-between gap-2 pl-1">
        <h2 className="text-sm font-semibold">Send this list to yourself</h2>
        <IconButton label="Close" onClick={onClose} className="size-8">
          <X aria-hidden className="size-4" />
        </IconButton>
      </div>

      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-label="Your phone number"
            placeholder="Your phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <a
            href={hasPhone ? smsLink(phone, text) : undefined}
            aria-disabled={!hasPhone}
            onClick={() => save(PHONE_KEY, phone)}
            className={buttonClass}
          >
            <MessageSquare aria-hidden className="size-4" /> Text to me
          </a>
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="Your email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <a
            href={hasEmail ? mailtoLink(email, listName, text) : undefined}
            aria-disabled={!hasEmail}
            onClick={() => save(EMAIL_KEY, email)}
            className={buttonClass}
          >
            <Mail aria-hidden className="size-4" /> Email to me
          </a>
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-muted">
        Opens your Messages or email app with the list filled in. Your number and email are
        remembered on this device only.
      </p>
    </div>
  );
}
