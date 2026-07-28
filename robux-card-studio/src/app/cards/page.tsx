"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readJson } from "@/lib/fetch-json";

type CardRow = {
  id: string;
  templateId: string;
  productSku?: string | null;
  outputPath?: string | null;
  status: string;
  dataJson: { denomination?: string; bindings?: Record<string, string> };
  createdAt: string;
};

export default function CardsPage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/cards");
        const d = await readJson<{ cards?: CardRow[]; error?: string }>(res);
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        setCards(d.cards ?? []);
      } catch (e) {
        setCards([]);
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Готовые карточки</h1>
        <p className="text-sm text-slate-400">
          Draft WebP 1024×1536 quality 90 · без автопубликации
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            Пока пусто. Создайте серию из{" "}
            <Link href="/templates" className="text-sky-400">
              шаблонов
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.id}>
              <div className="aspect-[2/3] bg-slate-950">
                {c.outputPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.outputPath}
                    alt={c.id}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <CardHeader>
                <CardTitle className="text-sm">
                  {c.productSku ?? "—"} ·{" "}
                  {c.dataJson?.denomination ??
                    c.dataJson?.bindings?.denomination ??
                    "?"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge>{c.status}</Badge>
                <div className="break-all text-xs text-slate-500">
                  {c.outputPath}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
