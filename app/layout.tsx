import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COMPILED — Hackathon",
  description: "아이디어를 코드로, COMPILED 해커톤.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
