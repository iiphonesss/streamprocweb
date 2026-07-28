"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import type { MaskRegion, MaskRole } from "@/types/card-studio";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/card-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COLORS: Record<MaskRole, string> = {
  text: "rgba(250, 204, 21, 0.35)",
  variable: "rgba(56, 189, 248, 0.4)",
  frame: "rgba(244, 63, 94, 0.35)",
  preserve: "rgba(52, 211, 153, 0.35)",
};

const STROKE: Record<MaskRole, string> = {
  text: "#facc15",
  variable: "#38bdf8",
  frame: "#f43f5e",
  preserve: "#34d399",
};

type Props = {
  imageUrl: string;
  masks: {
    textMask: MaskRegion[];
    variableMask: MaskRegion[];
    frameMask: MaskRegion[];
    preserveMask: MaskRegion[];
  };
  onChange: (masks: Props["masks"]) => void;
};

function useHtmlImage(url: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

export function MaskEditor({ imageUrl, masks, onChange }: Props) {
  const all: MaskRegion[] = [
    ...masks.textMask,
    ...masks.variableMask,
    ...masks.frameMask,
    ...masks.preserveMask,
  ];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<MaskRole | "all">("all");
  const [newRole, setNewRole] = useState<MaskRole>("variable");
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Rect | null>>({});
  const image = useHtmlImage(imageUrl);

  const scale = 0.35;
  const stageW = CANVAS_WIDTH * scale;
  const stageH = CANVAS_HEIGHT * scale;

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedId && shapeRefs.current[selectedId]) {
      tr.nodes([shapeRefs.current[selectedId]!]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedId, all]);

  function replaceAll(next: MaskRegion[]) {
    onChange({
      textMask: next.filter((r) => r.role === "text"),
      variableMask: next.filter((r) => r.role === "variable"),
      frameMask: next.filter((r) => r.role === "frame"),
      preserveMask: next.filter((r) => r.role === "preserve"),
    });
  }

  function updateRegion(id: string, patch: Partial<MaskRegion>) {
    replaceAll(all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRegion(id: string) {
    replaceAll(all.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function addRegion() {
    const region: MaskRegion = {
      id: crypto.randomUUID(),
      role: newRole,
      variableRole: newRole === "variable" ? "denomination" : undefined,
      x: CANVAS_WIDTH * 0.2,
      y: CANVAS_HEIGHT * 0.2,
      width: CANVAS_WIDTH * 0.3,
      height: CANVAS_HEIGHT * 0.08,
      label: `new-${newRole}`,
    };
    replaceAll([...all, region]);
    setSelectedId(region.id);
  }

  const visible =
    roleFilter === "all" ? all : all.filter((r) => r.role === roleFilter);
  const selected = all.find((r) => r.id === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2">
        <Stage
          width={stageW}
          height={stageH}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelectedId(null);
          }}
        >
          <Layer>
            {image && (
              <KonvaImage
                image={image}
                width={stageW}
                height={stageH}
                listening={false}
              />
            )}
            {visible.map((r) => (
              <Rect
                key={r.id}
                ref={(node) => {
                  shapeRefs.current[r.id] = node;
                }}
                x={r.x * scale}
                y={r.y * scale}
                width={r.width * scale}
                height={r.height * scale}
                fill={COLORS[r.role]}
                stroke={STROKE[r.role]}
                strokeWidth={2}
                draggable
                onClick={() => setSelectedId(r.id)}
                onTap={() => setSelectedId(r.id)}
                onDragEnd={(e) => {
                  updateRegion(r.id, {
                    x: e.target.x() / scale,
                    y: e.target.y() / scale,
                  });
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  const sy = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  updateRegion(r.id, {
                    x: node.x() / scale,
                    y: node.y() / scale,
                    width: Math.max(8, (node.width() * sx) / scale),
                    height: Math.max(8, (node.height() * sy) / scale),
                  });
                }}
              />
            ))}
            <Transformer ref={trRef} rotateEnabled={false} />
          </Layer>
        </Stage>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {(["all", "text", "variable", "frame", "preserve"] as const).map(
            (r) => (
              <Button
                key={r}
                size="sm"
                variant={roleFilter === r ? "default" : "outline"}
                onClick={() => setRoleFilter(r)}
              >
                {r}
              </Button>
            )
          )}
        </div>

        <div className="flex gap-2">
          <select
            className="h-10 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as MaskRole)}
          >
            <option value="text">text</option>
            <option value="variable">variable</option>
            <option value="frame">frame</option>
            <option value="preserve">preserve</option>
          </select>
          <Button onClick={addRegion}>Добавить</Button>
        </div>

        {selected && (
          <div className="space-y-2 rounded-lg border border-slate-800 p-3 text-sm">
            <div className="font-medium text-slate-100">{selected.label ?? selected.id}</div>
            <label className="block text-xs text-slate-400">Роль</label>
            <select
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2"
              value={selected.role}
              onChange={(e) =>
                updateRegion(selected.id, {
                  role: e.target.value as MaskRole,
                })
              }
            >
              <option value="text">text</option>
              <option value="variable">variable</option>
              <option value="frame">frame</option>
              <option value="preserve">preserve</option>
            </select>
            {selected.role === "variable" && (
              <>
                <label className="block text-xs text-slate-400">Variable role</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2"
                  value={selected.variableRole ?? "denomination"}
                  onChange={(e) =>
                    updateRegion(selected.id, {
                      variableRole: e.target.value as MaskRegion["variableRole"],
                    })
                  }
                >
                  <option value="title">title</option>
                  <option value="denomination">denomination</option>
                  <option value="currency">currency</option>
                  <option value="country">country</option>
                  <option value="footer">footer</option>
                </select>
              </>
            )}
            <label className="block text-xs text-slate-400">Label</label>
            <Input
              value={selected.label ?? ""}
              onChange={(e) => updateRegion(selected.id, { label: e.target.value })}
            />
            <Button variant="danger" size="sm" onClick={() => removeRegion(selected.id)}>
              Удалить область
            </Button>
          </div>
        )}

        <ul className="max-h-64 space-y-1 overflow-auto text-xs text-slate-400">
          {all.map((r) => (
            <li key={r.id}>
              <button
                className="w-full rounded px-2 py-1 text-left hover:bg-slate-800"
                onClick={() => setSelectedId(r.id)}
              >
                [{r.role}] {r.label ?? r.id.slice(0, 8)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
