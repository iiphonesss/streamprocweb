"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { readJson } from "@/lib/fetch-json";

type Template = {
  id: string;
  name: string;
  sourceSku: string;
  baseMode: string;
  baseImagePath: string;
  frameEnabled: boolean;
  status: string;
  updatedAt: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [series, setSeries] = useState("25, 50, 100");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/templates");
      const data = await readJson<{ templates?: Template[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTemplates(data.templates ?? []);
    } catch (e) {
      setTemplates([]);
      setError(e instanceof Error ? e.message : "Ошибка загрузки шаблонов");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSeries(templateId: string, sku: string) {
    setBusy(templateId);
    try {
      const denominations = series
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/cards/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          denominations,
          productSku: sku,
        }),
      });
      const data = await readJson<{ error?: string; count?: number }>(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      alert(`Создано ${data.count} карточек`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Шаблоны</h1>
        <p className="text-sm text-slate-400">
          Сохранённые основы для серий номиналов без повторного AI
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Номиналы по умолчанию:</span>
        <Input
          className="max-w-xs"
          value={series}
          onChange={(e) => setSeries(e.target.value)}
        />
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            Нет шаблонов.{" "}
            <Link href="/catalog" className="text-sky-400">
              Оцифруйте карточку
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="aspect-[2/3] overflow-hidden bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.baseImagePath}
                  alt={t.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>{t.sourceSku}</Badge>
                  <Badge>{t.baseMode}</Badge>
                  <Badge>{t.status}</Badge>
                </div>
                <Button
                  className="w-full"
                  disabled={busy === t.id}
                  onClick={() => createSeries(t.id, t.sourceSku)}
                >
                  Создать новые номиналы
                </Button>
                <Link
                  href={`/digitize/${t.sourceSku}`}
                  className="block text-center text-sm text-sky-400"
                >
                  Открыть оцифровку
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
