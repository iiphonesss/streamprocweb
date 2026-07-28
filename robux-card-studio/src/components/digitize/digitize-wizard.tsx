"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AnalysisSummary,
  BaseMode,
  EditableTextRegion,
  FrameAnalysis,
  MasksPayload,
  TextStyle,
  AddedObject,
} from "@/types/card-studio";
import { suggestFonts } from "@/lib/fonts";

const MaskEditor = dynamic(
  () =>
    import("@/components/digitize/mask-editor").then((m) => m.MaskEditor),
  { ssr: false }
);
const CardEditor = dynamic(
  () => import("@/components/editor/card-editor").then((m) => m.CardEditor),
  { ssr: false }
);

type Digitization = {
  id: string;
  status: string;
  originalPath?: string | null;
  cleanWithFramePath?: string | null;
  cleanWithoutFramePath?: string | null;
  frameAssetPath?: string | null;
  frameExtractionStatus?: string | null;
  selectedBaseMode?: string | null;
  textRegionsJson?: EditableTextRegion[] | null;
  masksJson?: MasksPayload | null;
  frameAnalysisJson?: FrameAnalysis | null;
  analysisSummaryJson?: AnalysisSummary | null;
  aiRequestCount?: number;
};

const STEPS = [
  "Оригинал",
  "Анализ",
  "Маски",
  "Clean BG",
  "Основа",
  "Текст",
  "Шаблон",
];

export function DigitizeWizard({ sku }: { sku: string }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"real" | "mock">("mock");
  const [product, setProduct] = useState<{
    sku: string;
    name: string;
    brand?: string | null;
    faceValue?: number | null;
    faceCurrency?: string | null;
    images: string[];
  } | null>(null);
  const [dig, setDig] = useState<Digitization | null>(null);
  const [masks, setMasks] = useState<MasksPayload | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [frame, setFrame] = useState<FrameAnalysis | null>(null);
  const [regions, setRegions] = useState<EditableTextRegion[]>([]);
  const [styles, setStyles] = useState<Record<string, TextStyle>>({});
  const [objects, setObjects] = useState<AddedObject[]>([]);
  const [frameEnabled, setFrameEnabled] = useState(true);
  const [baseMode, setBaseMode] = useState<BaseMode>("clean_with_frame");
  const [templateName, setTemplateName] = useState("");
  const [seriesInput, setSeriesInput] = useState("25, 50, 100, 250, 500, 1000");
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [pendingAi, setPendingAi] = useState<{
    title: string;
    endpoint: string;
    note: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/digitization/${encodeURIComponent(sku)}`);
      const text = await res.text();
      if (!text) {
        throw new Error(
          `Пустой ответ API (${res.status}). Проверьте /api/health и перезапустите npm run dev`
        );
      }
      const data = JSON.parse(text) as {
        error?: string;
        warning?: string | null;
        imageError?: string | null;
        product?: {
          sku: string;
          name: string;
          brand?: string | null;
          faceValue?: number | null;
          faceCurrency?: string | null;
          images: string[];
        };
        digitization?: Digitization;
        aiMode?: "real" | "mock";
      };
      if (!res.ok) throw new Error(data.error || "Load failed");
      if (!data.product || !data.digitization) {
        throw new Error("API вернул неполные данные оцифровки");
      }
      setProduct(data.product);
      setDig(data.digitization);
      setAiMode(data.aiMode ?? "mock");
      setMasks(data.digitization.masksJson ?? null);
      setSummary(data.digitization.analysisSummaryJson ?? null);
      setFrame(data.digitization.frameAnalysisJson ?? null);
      setRegions(data.digitization.textRegionsJson ?? []);
      if (data.digitization.selectedBaseMode) {
        setBaseMode(data.digitization.selectedBaseMode as BaseMode);
      }
      setTemplateName(`${data.product.sku} template`);
      if (data.warning) setError(data.warning);
    } catch (e) {
      setProduct(null);
      setDig(null);
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [sku]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runConfirmed(endpoint: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (data.digitization) setDig(data.digitization);
      if (data.summary) setSummary(data.summary);
      if (data.frame) setFrame(data.frame);
      if (data.masks) setMasks(data.masks);
      if (data.textRegions) {
        setRegions(data.textRegions);
        const nextStyles: Record<string, TextStyle> = {};
        for (const r of data.textRegions as EditableTextRegion[]) {
          nextStyles[r.id] = {
            fontFamily: suggestFonts(r.role)[0],
            fontSize: r.role === "denomination" ? 96 : 40,
            fontWeight: 700,
            color: "#ffffff",
            align: "center",
            lineHeight: 1.1,
            letterSpacing: 0,
            fontCandidates: suggestFonts(r.role),
          };
        }
        setStyles(nextStyles);
      }
      setPendingAi(null);
      await load();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function requestAiAction(
    title: string,
    endpoint: string,
    note: string
  ) {
    const probe = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await probe.json();
    setPendingAi({
      title,
      endpoint,
      note: data.willRun?.note ?? note,
    });
  }

  async function confirmMasks() {
    if (!masks) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/digitization/${sku}/masks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...masks, confirmed: true, textRegions: regions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mask save failed");
      setDig(data.digitization);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function selectBase(mode: BaseMode) {
    setBusy(true);
    try {
      const res = await fetch(`/api/digitization/${sku}/select-base`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseMode: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Select failed");
      setBaseMode(mode);
      setDig(data.digitization);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const baseImagePath = useMemo(() => {
    if (!dig) return null;
    if (baseMode === "original") return dig.originalPath;
    if (baseMode === "clean_with_frame") return dig.cleanWithFramePath;
    return dig.cleanWithoutFramePath;
  }, [dig, baseMode]);

  async function saveTemplate() {
    if (!dig || !baseImagePath) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName || `${sku} template`,
          sourceSku: sku,
          digitizationId: dig.id,
          baseMode,
          baseImagePath,
          frameAssetPath: dig.frameAssetPath,
          frameEnabled,
          textRegions: regions,
          textStyles: styles,
          addedObjects: objects,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Template save failed");
      setSavedTemplateId(data.template.id);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function createSeries() {
    if (!savedTemplateId) return;
    setBusy(true);
    setError(null);
    try {
      const denominations = seriesInput
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/cards/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: savedTemplateId,
          denominations,
          currency: product?.faceCurrency ?? "",
          title: product?.name ?? "",
          productSku: sku,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Series failed");
      alert(`Создано ${data.count} карточек без OpenAI`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Загрузка…</div>;
  }

  if (!product || !dig) {
    return (
      <div className="p-8">
        <p className="text-rose-400">{error ?? "Товар не найден"}</p>
        <Link href="/catalog" className="text-sky-400">
          ← Каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/catalog" className="text-sm text-sky-400">
            ← Каталог
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Оцифровка {product.sku}
          </h1>
          <p className="text-slate-400">{product.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>AI: {aiMode}</Badge>
          <Badge>AI requests: {dig.aiRequestCount ?? 0}</Badge>
          <Badge>{dig.status}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              step === i
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 px-4 py-3 text-rose-200">
          {error}
        </div>
      )}

      {pendingAi && (
        <Card className="border-amber-700/50 bg-amber-950/30">
          <CardHeader>
            <CardTitle>Подтверждение AI-действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium text-amber-100">{pendingAi.title}</p>
            <p className="text-sm text-amber-200/80">{pendingAi.note}</p>
            <p className="text-xs text-slate-400">
              Режим: {aiMode}. Ключ API не логируется. Image edit не запускается без
              подтверждения масок.
            </p>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => runConfirmed(pendingAi.endpoint)}>
                Запустить
              </Button>
              <Button variant="outline" onClick={() => setPendingAi(null)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dig.originalPath || product.images[0]}
              alt={product.name}
              className="mx-auto max-h-[640px] w-auto object-contain"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Данные товара</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <div>SKU: {product.sku}</div>
              <div>Бренд: {product.brand ?? "—"}</div>
              <div>
                Номинал: {product.faceValue ?? "—"} {product.faceCurrency ?? ""}
              </div>
              <div className="text-xs text-slate-500 break-all">
                images[0]: {product.images[0]}
              </div>
              <Button className="mt-4" onClick={() => setStep(1)}>
                Далее: Анализ
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Анализ структуры</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              Находит текст, переменные поля, рамку, сохраняемые объекты и тип фона.
              Не запускает image edit.
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                requestAiAction(
                  "Анализ карточки",
                  `/api/digitization/${sku}/analyze`,
                  "Структурный анализ изображения"
                )
              }
            >
              Запросить анализ
            </Button>
            {summary && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Найден номинал", summary.foundDenomination],
                  ["Найдена валюта", summary.foundCurrency],
                  ["Найдена рамка", summary.foundFrame],
                  ["Найден главный объект", summary.foundMainObject],
                  ["Найдены текстовые области", summary.foundTextAreas],
                ].map(([label, ok]) => (
                  <li
                    key={String(label)}
                    className="rounded-md border border-slate-800 px-3 py-2 text-sm"
                  >
                    {ok ? "✓" : "○"} {label}
                  </li>
                ))}
              </ul>
            )}
            {frame && (
              <div className="text-sm text-slate-400">
                Рамка: {frame.detected ? frame.frameType : "не найдена"} · confidence{" "}
                {frame.confidence}
              </div>
            )}
            {summary && (
              <Button onClick={() => setStep(2)}>Далее: проверка масок</Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && masks && (dig.originalPath || product.images[0]) && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Исправьте overlay перед платным image edit: text / variable / frame / preserve.
          </p>
          <MaskEditor
            imageUrl={dig.originalPath || product.images[0]}
            masks={masks}
            onChange={setMasks}
          />
          <div className="flex gap-2">
            <Button disabled={busy} onClick={confirmMasks}>
              Подтвердить маски
            </Button>
            <Button variant="outline" onClick={() => setStep(1)}>
              Назад
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Clean background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-400">
              A) удалить текст, сохранить объекты и рамку → clean-with-frame.webp
              <br />
              B) удалить рамку → clean-without-frame.webp
              <br />
              C) извлечь frame.png локально (без OpenAI)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || (dig.status !== "masks_confirmed" && !dig.cleanWithFramePath)}
                onClick={() =>
                  requestAiAction(
                    "Clean background with objects",
                    `/api/digitization/${sku}/clean-background`,
                    "Удаление текста в масках"
                  )
                }
              >
                Создать clean with frame
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !dig.cleanWithFramePath}
                onClick={() =>
                  requestAiAction(
                    "Remove frame",
                    `/api/digitization/${sku}/remove-frame`,
                    "Удаление рамки"
                  )
                }
              >
                Убрать рамку
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  requestAiAction(
                    "Extract frame asset",
                    `/api/digitization/${sku}/extract-frame`,
                    "Локальное извлечение рамки"
                  )
                }
              >
                Сохранить рамку отдельно
              </Button>
              <Button
                variant="ghost"
                disabled={!dig.cleanWithFramePath}
                onClick={() => setStep(4)}
              >
                Далее: выбор основы
              </Button>
            </div>
            {dig.frameExtractionStatus && (
              <Badge>frameExtractionStatus: {dig.frameExtractionStatus}</Badge>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Оригинал", dig.originalPath],
                ["Clean + frame", dig.cleanWithFramePath],
                ["Clean − frame", dig.cleanWithoutFramePath],
              ].map(([label, src]) =>
                src ? (
                  <div key={String(label)} className="rounded-lg border border-slate-800 p-2">
                    <div className="mb-1 text-xs text-slate-400">{label}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={String(src)} alt={String(label)} className="w-full rounded" />
                  </div>
                ) : null
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Оригинал", dig.originalPath, "original" as BaseMode],
              ["Clean с рамкой", dig.cleanWithFramePath, "clean_with_frame" as BaseMode],
              [
                "Clean без рамки",
                dig.cleanWithoutFramePath,
                "clean_without_frame" as BaseMode,
              ],
            ]
              .filter(([, src]) => Boolean(src))
              .map(([label, src, mode]) => (
                <button
                  key={String(mode)}
                  onClick={() => selectBase(mode as BaseMode)}
                  className={`rounded-xl border p-2 text-left ${
                    baseMode === mode
                      ? "border-sky-500 bg-slate-900"
                      : "border-slate-800 bg-slate-950"
                  }`}
                >
                  <div className="mb-1 text-sm">{label}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={String(src)} alt={String(label)} className="w-full rounded" />
                </button>
              ))}
            <div className="rounded-xl border border-slate-800 p-2">
              <div className="mb-1 text-sm">Собранная карточка</div>
              <p className="text-xs text-slate-500">
                Preview появится после настройки текста на следующем шаге.
              </p>
            </div>
          </div>
          {dig.frameAssetPath && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={frameEnabled}
                onChange={(e) => setFrameEnabled(e.target.checked)}
              />
              Показывать рамку (frame asset)
            </label>
          )}
          <Button onClick={() => setStep(5)}>Далее: текст</Button>
        </div>
      )}

      {step === 5 && baseImagePath && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Текст рисуется программно (не через OpenAI). Выберите шрифт из 3 кандидатов.
          </p>
          <CardEditor
            imageUrl={baseImagePath}
            frameUrl={dig.frameAssetPath}
            initialRegions={regions}
            initialStyles={styles}
            initialObjects={objects}
            frameEnabled={frameEnabled}
            bindings={{
              denomination: product.faceValue != null ? String(product.faceValue) : "??",
              currency: product.faceCurrency ?? "",
              title: product.name,
            }}
            onChange={(s) => {
              setRegions(s.regions);
              setStyles(s.styles);
              setObjects(s.objects);
              setFrameEnabled(s.frameEnabled);
            }}
          />
          <Button onClick={() => setStep(6)}>Далее: сохранить шаблон</Button>
        </div>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаблон и номиналы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-sm text-slate-400">Имя шаблона</label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button disabled={busy || !baseImagePath} onClick={saveTemplate}>
              Сохранить шаблон
            </Button>
            {savedTemplateId && (
              <div className="space-y-3 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4">
                <p className="text-sm text-emerald-200">
                  Шаблон сохранён: {savedTemplateId}. Новые номиналы без OpenAI.
                </p>
                <label className="block text-sm text-slate-400">
                  Номиналы (через запятую)
                </label>
                <Input
                  value={seriesInput}
                  onChange={(e) => setSeriesInput(e.target.value)}
                />
                <Button disabled={busy} onClick={createSeries}>
                  Создать новые номиналы
                </Button>
                <Link href="/cards" className="block text-sky-400 text-sm">
                  Открыть готовые карточки →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
