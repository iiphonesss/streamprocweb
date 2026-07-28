"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/catalog", label: "Каталог" },
  { href: "/templates", label: "Шаблоны" },
  { href: "/cards", label: "Готовые карточки" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/catalog" className="font-semibold tracking-tight text-sky-300">
          Robux Card Studio
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white",
                pathname.startsWith(l.href) && "bg-slate-800 text-white"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
