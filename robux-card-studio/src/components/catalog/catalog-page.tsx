"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { readJson } from "@/lib/fetch-json";

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
  const [syncingMarket, setSyncingMarket] = useState(false);
  const [marketConfigured, setMarketConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(params?: { q?: string; brand?: string }) {
    setLoading(true);
    setMessage(null);
    try {
      const sp = new URLSearchParams();
      if (params?.q) sp.set("q", params.q);
      if (params?.brand) sp.set("brand", params.brand);
      const res = await fetch(`/api/catalog/products?${sp.toString()}`);
      const data = await readJson<{
        products?: Product[];
        brands?: string[];
        error?: string;
        hint?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || data.hint || `HTTP ${res.status}`);
      }
      setProducts(data.products ?? []);
      setBrands(data.brands ?? []);
    } catch (e) {
      setProducts([]);
      setBrands([]);
      setMessage(e instanceof Error ? e.message : "Ошибка загрузки каталога");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void fetch("/api/catalog/sync-market")
      .then((r) => readJson<{ configured?: boolean }>(r))
      .then((d) => setMarketConfigured(Boolean(d.configured)))
      .catch(() => setMarketConfigured(false));
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
      const data = await readJson<{
        error?: string;
        imported?: number;
        updated?: number;
        total?: number;
      }>(res);
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

  async function syncMarketDb() {
    setSyncingMarket(true);
    setMessage(null);
    try {
      const res = await fetch("/api/catalog/sync-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await readJson<{
        error?: string;
        hint?: string;
        imported?: number;
        updated?: number;
        total?: number;
      }>(res);
      if (!res.ok) {
        throw new Error(
          data.error || data.hint || "Не удалось синхронизировать market DB"
        );
      }
      setMessage(
        `Market DB (read-only): +${data.imported}, обновлено ${data.updated}, всего ${data.total}`
      );
      await load({ q, brand });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Market sync error");
    } finally {
      setSyncingMarket(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Каталог</h1>
          <p className="text-sm text-slate-400">
            Импорт catalog.json или read-only sync из market DB → оцифровка
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={syncingMarket}
            onClick={syncMarketDb}
            title={
              marketConfigured
                ? "SELECT из market DB → локальный SQLite"
                : "Сначала задайте MARKET_DATABASE_URL в .env.local"
            }
          >
            {syncingMarket
              ? "Синхронизация…"
              : marketConfigured
                ? "Загрузить из market DB"
                : "Market DB не настроена"}
          </Button>
          <Button disabled={importing} onClick={importCatalog}>
            {importing ? "Импорт…" : "Импортировать catalog.json"}
          </Button>
        </div>
      </div>
      {!marketConfigured && (
        <div className="rounded-md border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Чтобы подтянуть карточки из вашей БД (только чтение), добавьте в{" "}
          <code className="text-amber-200">.env.local</code>:
          <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-xs text-amber-50">{`MARKET_DATABASE_URL=postgresql://postgres:postgres@localhost:5440/robux_market_admin`}</pre>
          Production не изменяется — только SELECT, запись только в локальный SQLite Card Studio.
        </div>
      )}

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
        <Button variant="secondary" onClick={() => load({ q, brand })}>
          Найти
        </Button>
        <span className="self-center text-xs text-slate-500">{filteredHint}</span>
      </div>

      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            Каталог пуст. Нажмите «Импортировать catalog.json» или «Загрузить из
            market DB».
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
                <Link
                  href={`/digitize/${encodeURIComponent(p.sku)}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Оцифровать карточку
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
