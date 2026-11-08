"use client";

import { useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  const toast = message ? (
    <div
      key={message.key}
      role="status"
      className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2 text-sm text-card shadow-lg print:hidden"
    >
      {message.text}
    </div>
  ) : null;

  return { toast, showToast: (text: string) => setMessage({ text, key: Date.now() }) };
}
