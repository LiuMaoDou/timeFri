import type { Metadata } from "next";
import "./globals.css";

const themeBootstrapScript = `
(() => {
  const storageKey = "timeFri.theme.v1";
  const supported = new Set(["light", "dark", "system"]);
  let preference = "system";

  try {
    const stored = window.localStorage.getItem(storageKey);
    preference = supported.has(stored) ? stored : "system";
  } catch {}

  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = preference === "system"
    ? systemPrefersDark ? "dark" : "light"
    : preference;

  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = theme;
})();`;

export const metadata: Metadata = {
  title: "timeFri",
  description: "A quiet timer for focused work.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
