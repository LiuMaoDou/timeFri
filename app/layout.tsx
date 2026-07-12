import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "timeFri",
  description: "A quiet timer for focused work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
