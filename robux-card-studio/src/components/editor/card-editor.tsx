"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Rect, Line } from "react-konva";
import type Konva from "konva";
import type { AddedObject, EditableTextRegion, TextStyle } from "@/types/card-studio";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/card-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FONT_CANDIDATES, suggestFonts } from "@/lib/fonts";

type HistoryState = {
  regions: EditableTextRegion[];
  styles: Record<string, TextStyle>;
  objects: AddedObject[];
  frameEnabled: boolean;
};

type Props = {
  imageUrl: string;
  frameUrl?: string | null;
  initialRegions: EditableTextRegion[];
  initialStyles?: Record<string, TextStyle>;
  initialObjects?: AddedObject[];
  frameEnabled?: boolean;
  bindings?: Record<string, string>;
  onChange: (state: HistoryState) => void;
};

function useHtmlImage(url?: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

function defaultStyle(role: string): TextStyle {
  const candidates = suggestFonts(role);
  return {
    fontFamily: candidates[0],
    fontSize: role === "denomination" ? 96 : 40,
    fontWeight: 700,
    color: "#ffffff",
    align: "center",
    lineHeight: 1.1,
    letterSpacing: 0,
    shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 2 },
    fontCandidates: candidates,
  };
}

export function CardEditor({
  imageUrl,
  frameUrl,
  initialRegions,
  initialStyles,
  initialObjects = [],
  frameEnabled: frameEnabledProp = true,
  bindings = {},
  onChange,
}: Props) {
  const [regions, setRegions] = useState(initialRegions);
  const [styles, setStyles] = useState<Record<string, TextStyle>>(() => {
    const map: Record<string, TextStyle> = { ...(initialStyles ?? {}) };
    for (const r of initialRegions) {
      if (!map[r.id]) map[r.id] = defaultStyle(r.role);
    }
    return map;
  });
  const [objects, setObjects] = useState<AddedObject[]>(initialObjects);
  const [frameEnabled, setFrameEnabled] = useState(frameEnabledProp);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const image = useHtmlImage(imageUrl);
  const frame = useHtmlImage(frameEnabled ? frameUrl : null);

  const scale = 0.35;
  const stageW = CANVAS_WIDTH * scale;
  const stageH = CANVAS_HEIGHT * scale;

  const selectedRegion = regions.find((r) => r.id === selectedId);
  const selectedObject = objects.find((o) => o.id === selectedId);
  const selectedStyle = selectedRegion ? styles[selectedRegion.id] : null;

  function snapshot(): HistoryState {
    return {
      regions: structuredClone(regions),
      styles: structuredClone(styles),
      objects: structuredClone(objects),
      frameEnabled,
    };
  }

  function pushHistory() {
    setHistory((h) => [...h.slice(-40), snapshot()]);
    setFuture([]);
  }

  function emit(next: Partial<HistoryState>) {
    const state: HistoryState = {
      regions: next.regions ?? regions,
      styles: next.styles ?? styles,
      objects: next.objects ?? objects,
      frameEnabled: next.frameEnabled ?? frameEnabled,
    };
    if (next.regions) setRegions(next.regions);
    if (next.styles) setStyles(next.styles);
    if (next.objects) setObjects(next.objects);
    if (next.frameEnabled != null) setFrameEnabled(next.frameEnabled);
    onChange(state);
  }

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedId && nodeRefs.current[selectedId]) {
      tr.nodes([nodeRefs.current[selectedId]!]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedId, regions, objects]);

  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setFuture((f) => [snapshot(), ...f]);
    setHistory((h) => h.slice(0, -1));
    emit(prev);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, snapshot()]);
    setFuture((f) => f.slice(1));
    emit(next);
  }

  function updateStyle(patch: Partial<TextStyle>) {
    if (!selectedRegion) return;
    pushHistory();
    const next = {
      ...styles,
      [selectedRegion.id]: { ...styles[selectedRegion.id], ...patch },
    };
    emit({ styles: next });
  }

  function contentFor(r: EditableTextRegion) {
    return bindings[r.role] ?? bindings[r.id] ?? r.content ?? r.role;
  }

  const candidates = useMemo(
    () => selectedStyle?.fontCandidates ?? FONT_CANDIDATES.slice(0, 3),
    [selectedStyle]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2">
        <div className="mb-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={undo}>
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={redo}>
            Redo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              pushHistory();
              emit({ frameEnabled: !frameEnabled });
            }}
          >
            {frameEnabled ? "Скрыть рамку" : "Показать рамку"}
          </Button>
        </div>
        <Stage
          width={stageW}
          height={stageH}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelectedId(null);
          }}
        >
          <Layer>
            {image && (
              <KonvaImage image={image} width={stageW} height={stageH} listening={false} />
            )}
            {frame && (
              <KonvaImage image={frame} width={stageW} height={stageH} listening={false} />
            )}
            {regions.map((r) => {
              const st = styles[r.id] ?? defaultStyle(r.role);
              return (
                <Text
                  key={r.id}
                  ref={(n) => {
                    nodeRefs.current[r.id] = n;
                  }}
                  x={r.x * scale}
                  y={r.y * scale}
                  width={r.width * scale}
                  text={contentFor(r)}
                  fontSize={st.fontSize * scale}
                  fontFamily={st.fontFamily}
                  fontStyle={String(st.fontWeight)}
                  fill={st.color}
                  align={st.align}
                  draggable
                  onClick={() => setSelectedId(r.id)}
                  onTap={() => setSelectedId(r.id)}
                  onDragEnd={(e) => {
                    pushHistory();
                    emit({
                      regions: regions.map((x) =>
                        x.id === r.id
                          ? { ...x, x: e.target.x() / scale, y: e.target.y() / scale }
                          : x
                      ),
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const sx = node.scaleX();
                    node.scaleX(1);
                    node.scaleY(1);
                    pushHistory();
                    emit({
                      regions: regions.map((x) =>
                        x.id === r.id
                          ? {
                              ...x,
                              x: node.x() / scale,
                              y: node.y() / scale,
                              width: Math.max(20, (node.width() * sx) / scale),
                            }
                          : x
                      ),
                    });
                  }}
                />
              );
            })}
            {objects.map((o) => {
              if (o.type === "rect" || o.type === "dim" || o.type === "badge") {
                return (
                  <Rect
                    key={o.id}
                    ref={(n) => {
                      nodeRefs.current[o.id] = n;
                    }}
                    x={o.x * scale}
                    y={o.y * scale}
                    width={o.width * scale}
                    height={o.height * scale}
                    fill={String(o.props.fill ?? "rgba(0,0,0,0.35)")}
                    cornerRadius={o.type === "badge" ? 8 : 0}
                    draggable
                    onClick={() => setSelectedId(o.id)}
                    onDragEnd={(e) => {
                      pushHistory();
                      emit({
                        objects: objects.map((x) =>
                          x.id === o.id
                            ? { ...x, x: e.target.x() / scale, y: e.target.y() / scale }
                            : x
                        ),
                      });
                    }}
                  />
                );
              }
              if (o.type === "line") {
                return (
                  <Line
                    key={o.id}
                    points={[
                      o.x * scale,
                      o.y * scale,
                      (o.x + o.width) * scale,
                      (o.y + o.height) * scale,
                    ]}
                    stroke={String(o.props.stroke ?? "#fff")}
                    strokeWidth={Number(o.props.strokeWidth ?? 3)}
                    onClick={() => setSelectedId(o.id)}
                  />
                );
              }
              if (o.type === "text") {
                return (
                  <Text
                    key={o.id}
                    ref={(n) => {
                      nodeRefs.current[o.id] = n;
                    }}
                    x={o.x * scale}
                    y={o.y * scale}
                    text={String(o.props.text ?? "")}
                    fontSize={Number(o.props.fontSize ?? 32) * scale}
                    fill={String(o.props.fill ?? "#fff")}
                    draggable
                    onClick={() => setSelectedId(o.id)}
                    onDragEnd={(e) => {
                      pushHistory();
                      emit({
                        objects: objects.map((x) =>
                          x.id === o.id
                            ? { ...x, x: e.target.x() / scale, y: e.target.y() / scale }
                            : x
                        ),
                      });
                    }}
                  />
                );
              }
              return null;
            })}
            <Transformer ref={trRef} rotateEnabled={false} />
          </Layer>
        </Stage>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["text", "Текст"],
              ["rect", "Прямоуг."],
              ["dim", "Затемнение"],
              ["line", "Линия"],
              ["badge", "Badge"],
            ] as const
          ).map(([type, label]) => (
            <Button
              key={type}
              size="sm"
              variant="outline"
              onClick={() => {
                pushHistory();
                const obj: AddedObject = {
                  id: crypto.randomUUID(),
                  type,
                  x: 120,
                  y: 200,
                  width: type === "line" ? 200 : 180,
                  height: type === "line" ? 0 : 60,
                  zIndex: objects.length + 1,
                  props:
                    type === "text"
                      ? { text: "New text", fontSize: 36, fill: "#fff" }
                      : type === "badge"
                        ? { text: "NEW", fill: "#0f172a", fontSize: 24 }
                        : type === "dim"
                          ? { fill: "rgba(0,0,0,0.4)" }
                          : type === "line"
                            ? { stroke: "#fff", strokeWidth: 3 }
                            : { fill: "rgba(255,255,255,0.15)" },
                };
                emit({ objects: [...objects, obj] });
                setSelectedId(obj.id);
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        {selectedRegion && selectedStyle && (
          <div className="space-y-2 rounded-lg border border-slate-800 p-3">
            <div className="font-medium">{selectedRegion.role}</div>
            <label className="text-xs text-slate-400">Шрифт (3 варианта)</label>
            <div className="grid gap-1">
              {candidates.slice(0, 3).map((f) => (
                <button
                  key={f}
                  className={`rounded border px-2 py-2 text-left ${
                    selectedStyle.fontFamily === f
                      ? "border-sky-500 bg-slate-800"
                      : "border-slate-700"
                  }`}
                  style={{ fontFamily: f }}
                  onClick={() => updateStyle({ fontFamily: f })}
                >
                  {f} — {contentFor(selectedRegion)}
                </button>
              ))}
            </div>
            <label className="text-xs text-slate-400">Size</label>
            <Input
              type="number"
              value={selectedStyle.fontSize}
              onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
            />
            <label className="text-xs text-slate-400">Color</label>
            <Input
              type="color"
              value={selectedStyle.color}
              onChange={(e) => updateStyle({ color: e.target.value })}
            />
            <label className="text-xs text-slate-400">Align</label>
            <select
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2"
              value={selectedStyle.align}
              onChange={(e) =>
                updateStyle({ align: e.target.value as TextStyle["align"] })
              }
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
            <label className="text-xs text-slate-400">Letter spacing</label>
            <Input
              type="number"
              value={selectedStyle.letterSpacing}
              onChange={(e) =>
                updateStyle({ letterSpacing: Number(e.target.value) })
              }
            />
          </div>
        )}

        {selectedObject && (
          <div className="space-y-2 rounded-lg border border-slate-800 p-3">
            <div className="font-medium">{selectedObject.type}</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  pushHistory();
                  emit({
                    objects: objects.map((o) =>
                      o.id === selectedObject.id
                        ? { ...o, zIndex: o.zIndex + 1 }
                        : o
                    ),
                  });
                }}
              >
                Вперёд
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  pushHistory();
                  emit({
                    objects: objects.filter((o) => o.id !== selectedObject.id),
                  });
                  setSelectedId(null);
                }}
              >
                Удалить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
