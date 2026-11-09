import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "autops — Understand your service with confidence",
  description: "Infrastructure consulting for non-developers, from your service architecture to improvement priorities. Explore the autops demo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
