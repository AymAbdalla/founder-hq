import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Founder HQ",
  description: "One place for every project you are building and what each one needs next.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
