import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Robux Card Studio",
  description:
    "Digitize gift/game cards: analyze, clean backgrounds, templates, denomination series",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${dmSans.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
