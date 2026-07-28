"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Product = {
  sku: string;
  name: string;
  brand?: string | null;
  faceValue?: number | null;
  faceCurrency?: string | null;
  primaryImage?: string | null;
  status: string;
  statusLabel: string;
  isActive: boolean;
};

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(params?: { q?: string; brand?: string }) {
    setLoading(true);
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.brand) sp.set("brand", params.brand);
    const res = await fetch(`/api/catalog/products?${sp.toString()}`);
    const data = await res.json();
    setProducts(data.products ?? []);
    setBrands(data.brands ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredHint = useMemo(
    () => `${products.length} товар(ов)`,
    [products.length]
  );

  async function importCatalog() {
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "data/catalog.json" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMessage(
        `Импорт: +${data.imported}, обновлено ${data.updated}, всего ${data.total}`
      );
      await load({ q, brand });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Каталог</h1>
          <p className="text-sm text-slate-400">
            Импорт catalog.json → выбор товара → оцифровка
          </p>
        </div>
        <Button disabled={importing} onClick={importCatalog}>
          {importing ? "Импорт…" : "Импортировать catalog.json"}
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Поиск по SKU или названию"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          onClick={() => load({ q, brand })}
        >
          Найти
        </Button>
        <span className="self-center text-xs text-slate-500">{filteredHint}</span>
      </div>

      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            Каталог пуст. Нажмите «Импортировать catalog.json».
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.sku} className="overflow-hidden">
              <div className="aspect-[2/3] bg-slate-950">
                {p.primaryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.primaryImage}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    Нет изображения
                  </div>
                )}
              </div>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span>{p.name}</span>
                  <Badge>{p.sku}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-slate-400">
                  {p.brand ?? "—"} · {p.faceValue ?? "—"} {p.faceCurrency ?? ""}
                </div>
                <Badge>{p.statusLabel}</Badge>
                <Button asChild className="w-full">
                  <Link href={`/digitize/${p.sku}`}>Оцифровать карточку</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
