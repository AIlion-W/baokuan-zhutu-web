import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "爆款主图复刻",
  description: "拆解爆款主图，一键裂变出新方案",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
