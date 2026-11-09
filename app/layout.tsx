import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compiled — 내 서비스를 이해하는 가장 쉬운 방법",
  description: "서비스 구조부터 개선 우선순위까지, 비개발자를 위한 쉬운 인프라 컨설팅. Compiled 제품 데모를 만나보세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
