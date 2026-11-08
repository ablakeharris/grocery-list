import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Grocery Lists",
  description: "Shared grocery lists for the house",
  appleWebApp: { capable: true, title: "Groceries" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <main className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6 sm:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </body>
    </html>
  );
}
