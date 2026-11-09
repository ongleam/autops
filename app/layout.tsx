import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://autops-app.vercel.app"),
  title: "autops — AI DevOps for solo builders",
  description: "Build alone, operate with AI. autops connects your code and service context so solo builders can inspect, verify, and improve what they ship.",
  alternates: { canonical: "/", types: { "text/plain": "/llms.txt" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
