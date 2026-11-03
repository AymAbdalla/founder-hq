import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Founder HQ",
  description: "One place for every project you are building and what each one needs next.",
  // Installed on an iPhone's Home Screen, HQ opens in its own window (spec 3.5).
  appleWebApp: { capable: true, title: "HQ", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0f1f17" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The theme switch stores "light" or "dark" in a cookie. With no cookie, CSS follows the device.
  const saved = (await cookies()).get("hq-theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
