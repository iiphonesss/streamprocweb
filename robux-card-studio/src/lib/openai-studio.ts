import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { toFile } from "openai";
import type {
  AnalysisSummary,
  EditableTextRegion,
  FrameAnalysis,
  MasksPayload,
  MaskRegion,
} from "@/types/card-studio";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/card-studio";
import { randomUUID } from "crypto";

const TEXT_CLEAN_PROMPT = `Remove only the text, numbers, currency labels, country labels,
watermarks and interface-like elements inside the masked areas.

Reconstruct the underlying background naturally.

Preserve all characters, faces, clothing, objects, lighting,
colors, composition and every unmasked area.

Do not redesign the image.
Do not create new characters.
Do not move objects.
Do not add text, symbols, logos, borders or decorative elements.`;

const FRAME_REMOVE_PROMPT = `Remove only the detected frame or border inside the masked area.

Reconstruct the underlying background naturally.

Preserve all characters, objects, lighting, colors, composition
and every unmasked area.

Do not redesign the image.
Do not add text, logos, symbols, new borders or decorations.`;

export function getAiMode(): "real" | "mock" {
  const mode = (process.env.CARD_STUDIO_AI_MODE ?? "mock").toLowerCase();
  if (mode === "real" && process.env.OPENAI_API_KEY) return "real";
  return "mock";
}

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: key });
}

function getMaxRequests(): number {
  return Number(process.env.CARD_STUDIO_MAX_AI_REQUESTS_PER_SESSION ?? 20);
}

export function assertAiBudget(used: number) {
  if (used >= getMaxRequests()) {
    throw new Error(
      `AI request limit reached (${getMaxRequests()} per session)`
    );
  }
}

function heuristicAnalysis(input: {
  sku: string;
  name: string;
  faceValue?: number | null;
  faceCurrency?: string | null;
}): {
  summary: AnalysisSummary;
  frame: FrameAnalysis;
  textRegions: EditableTextRegion[];
  masks: MasksPayload;
} {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  const hasValue =
    input.faceValue != null && !Number.isNaN(Number(input.faceValue));
  const hasCurrency = Boolean(input.faceCurrency);

  const denomination: EditableTextRegion = {
    id: randomUUID(),
    role: "denomination",
    x: Math.round(W * 0.18),
    y: Math.round(H * 0.72),
    width: Math.round(W * 0.45),
    height: Math.round(H * 0.1),
    content: hasValue ? String(input.faceValue) : undefined,
    confidence: hasValue ? 0.75 : 0.35,
  };

  const currency: EditableTextRegion = {
    id: randomUUID(),
    role: "currency",
    x: Math.round(W * 0.65),
    y: Math.round(H * 0.74),
    width: Math.round(W * 0.2),
    height: Math.round(H * 0.06),
    content: input.faceCurrency ?? undefined,
    confidence: hasCurrency ? 0.7 : 0.3,
  };

  const title: EditableTextRegion = {
    id: randomUUID(),
    role: "title",
    x: Math.round(W * 0.1),
    y: Math.round(H * 0.08),
    width: Math.round(W * 0.8),
    height: Math.round(H * 0.07),
    content: input.name,
    confidence: 0.55,
  };

  const country: EditableTextRegion = {
    id: randomUUID(),
    role: "country",
    x: Math.round(W * 0.1),
    y: Math.round(H * 0.88),
    width: Math.round(W * 0.35),
    height: Math.round(H * 0.05),
    content: input.sku === "RM063" ? "TRY" : undefined,
    confidence: input.sku === "RM063" ? 0.6 : 0.25,
  };

  const footer: EditableTextRegion = {
    id: randomUUID(),
    role: "footer",
    x: Math.round(W * 0.1),
    y: Math.round(H * 0.93),
    width: Math.round(W * 0.8),
    height: Math.round(H * 0.04),
    confidence: 0.4,
  };

  const textRegions = [title, denomination, currency, country, footer];

  const toMask = (
    r: EditableTextRegion,
    role: MaskRegion["role"],
    label: string
  ): MaskRegion => ({
    id: randomUUID(),
    role,
    variableRole: r.role === "other" ? undefined : r.role,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    label,
  });

  const variableMask = textRegions
    .filter((r) => ["denomination", "currency", "country", "title", "footer"].includes(r.role))
    .map((r) => toMask(r, "variable", r.role));

  const textMask = textRegions.map((r) => toMask(r, "text", `text:${r.role}`));

  const frameMask: MaskRegion[] = [
    {
      id: randomUUID(),
      role: "frame",
      x: Math.round(W * 0.03),
      y: Math.round(H * 0.02),
      width: Math.round(W * 0.94),
      height: Math.round(H * 0.04),
      label: "frame-top",
    },
    {
      id: randomUUID(),
      role: "frame",
      x: Math.round(W * 0.03),
      y: Math.round(H * 0.94),
      width: Math.round(W * 0.94),
      height: Math.round(H * 0.04),
      label: "frame-bottom",
    },
    {
      id: randomUUID(),
      role: "frame",
      x: Math.round(W * 0.02),
      y: Math.round(H * 0.02),
      width: Math.round(W * 0.04),
      height: Math.round(H * 0.96),
      label: "frame-left",
    },
    {
      id: randomUUID(),
      role: "frame",
      x: Math.round(W * 0.94),
      y: Math.round(H * 0.02),
      width: Math.round(W * 0.04),
      height: Math.round(H * 0.96),
      label: "frame-right",
    },
  ];

  const preserveMask: MaskRegion[] = [
    {
      id: randomUUID(),
      role: "preserve",
      x: Math.round(W * 0.15),
      y: Math.round(H * 0.2),
      width: Math.round(W * 0.7),
      height: Math.round(H * 0.45),
      label: "main-object",
    },
  ];

  if (input.sku === "RM063") {
    preserveMask.push({
      id: randomUUID(),
      role: "preserve",
      x: Math.round(W * 0.35),
      y: Math.round(H * 0.28),
      width: Math.round(W * 0.3),
      height: Math.round(H * 0.25),
      label: "apple",
    });
    preserveMask.push({
      id: randomUUID(),
      role: "preserve",
      x: Math.round(W * 0.72),
      y: Math.round(H * 0.12),
      width: Math.round(W * 0.18),
      height: Math.round(H * 0.1),
      label: "flag",
    });
  }

  const frame: FrameAnalysis = {
    detected: true,
    frameType: "outer",
    rect: {
      x: Math.round(W * 0.02),
      y: Math.round(H * 0.02),
      width: Math.round(W * 0.96),
      height: Math.round(H * 0.96),
    },
    thickness: Math.round(W * 0.04),
    radius: 24,
    color: "#ffffff",
    opacity: 0.9,
    confidence: 0.65,
    canExtractAsAsset: true,
    warnings: getAiMode() === "mock" ? ["Mock analysis — verify masks manually"] : [],
  };

  const summary: AnalysisSummary = {
    foundDenomination: hasValue,
    foundCurrency: hasCurrency,
    foundFrame: true,
    foundMainObject: true,
    foundTextAreas: true,
    backgroundType: "illustrated",
    notes: [
      getAiMode() === "mock"
        ? "Режим mock: зоны построены эвристически. Подтвердите маски перед image edit."
        : "Проверьте маски перед платным image edit.",
    ],
  };

  return {
    summary,
    frame,
    textRegions,
    masks: { textMask, variableMask, frameMask, preserveMask },
  };
}

export async function analyzeCardStructure(input: {
  sku: string;
  name: string;
  faceValue?: number | null;
  faceCurrency?: string | null;
  imagePath: string;
  usedAiRequests: number;
}): Promise<{
  summary: AnalysisSummary;
  frame: FrameAnalysis;
  textRegions: EditableTextRegion[];
  masks: MasksPayload;
  aiUsed: boolean;
}> {
  if (getAiMode() !== "real") {
    return { ...heuristicAnalysis(input), aiUsed: false };
  }

  assertAiBudget(input.usedAiRequests);
  const client = getClient();
  const imageBytes = await fs.readFile(input.imagePath);
  const b64 = imageBytes.toString("base64");

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this gift/game card image for digitization.
Return STRICT JSON with keys: summary, frame, textRegions, masks.
Canvas is ${CANVAS_WIDTH}x${CANVAS_HEIGHT}. Coordinates in pixels.
summary: {foundDenomination,foundCurrency,foundFrame,foundMainObject,foundTextAreas,backgroundType,notes[]}
frame: FrameAnalysis shape with detected, frameType, rect, thickness, radius, color, opacity, confidence, canExtractAsAsset, warnings
textRegions: EditableTextRegion[] roles title|denomination|currency|country|footer|other
masks: {textMask,variableMask,frameMask,preserveMask} each MaskRegion[] with id,role,x,y,width,height,label
Product: SKU ${input.sku}, name ${input.name}, faceValue ${input.faceValue ?? "n/a"}, currency ${input.faceCurrency ?? "n/a"}
Do not invent dozens of tiny objects. Focus on main text, frame, and preserve regions.`,
          },
          {
            type: "input_image",
            detail: "auto",
            image_url: `data:image/webp;base64,${b64}`,
          },
        ],
      },
    ],
    text: { format: { type: "json_object" } },
  });

  const text = response.output_text;
  try {
    const parsed = JSON.parse(text) as {
      summary: AnalysisSummary;
      frame: FrameAnalysis;
      textRegions: EditableTextRegion[];
      masks: MasksPayload;
    };
    return { ...parsed, aiUsed: true };
  } catch {
    return { ...heuristicAnalysis(input), aiUsed: true };
  }
}

async function buildMaskPng(
  width: number,
  height: number,
  regions: MaskRegion[]
): Promise<Buffer> {
  const svgRects = regions
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="white"/>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="black"/>
    ${svgRects}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function mockInpaint(
  imagePath: string,
  regions: MaskRegion[],
  outPath: string,
  soften = false
): Promise<string> {
  const img = sharp(imagePath);
  const meta = await img.metadata();
  const w = meta.width ?? CANVAS_WIDTH;
  const h = meta.height ?? CANVAS_HEIGHT;
  const base = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Soft blur of masked regions as mock text/frame removal
  let pipeline = sharp(imagePath).resize(w, h);
  if (regions.length && soften) {
    const overlays = await Promise.all(
      regions.map(async (r) => {
        const crop = await sharp(imagePath)
          .extract({
            left: Math.max(0, Math.round(r.x)),
            top: Math.max(0, Math.round(r.y)),
            width: Math.min(w - Math.round(r.x), Math.max(1, Math.round(r.width))),
            height: Math.min(h - Math.round(r.y), Math.max(1, Math.round(r.height))),
          })
          .blur(12)
          .toBuffer();
        return {
          input: crop,
          left: Math.max(0, Math.round(r.x)),
          top: Math.max(0, Math.round(r.y)),
        };
      })
    );
    pipeline = sharp(imagePath).composite(overlays);
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await pipeline.webp({ quality: 90 }).toFile(outPath);
  void base;
  return outPath;
}

async function openaiEdit(
  imagePath: string,
  maskRegions: MaskRegion[],
  prompt: string,
  outPath: string,
  usedAiRequests: number
): Promise<{ path: string; aiUsed: boolean }> {
  if (getAiMode() !== "real") {
    await mockInpaint(imagePath, maskRegions, outPath, true);
    return { path: outPath, aiUsed: false };
  }

  assertAiBudget(usedAiRequests);
  const client = getClient();
  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? CANVAS_WIDTH;
  const h = meta.height ?? CANVAS_HEIGHT;
  const maskPng = await buildMaskPng(w, h, maskRegions);
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

  const imageFile = await toFile(await fs.readFile(imagePath), "source.png", {
    type: "image/png",
  });
  // Ensure png source for edit API
  const pngBuf = await sharp(imagePath).png().toBuffer();
  const pngFile = await toFile(pngBuf, "source.png", { type: "image/png" });
  const maskFile = await toFile(maskPng, "mask.png", { type: "image/png" });
  void imageFile;

  const result = await client.images.edit({
    model,
    image: pngFile,
    mask: maskFile,
    prompt,
    size: "1024x1536" as `${number}x${number}`,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image edit returned empty result");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(b64, "base64")).webp({ quality: 90 }).toFile(outPath);
  return { path: outPath, aiUsed: true };
}

export async function createCleanWithFrame(opts: {
  imagePath: string;
  masks: MasksPayload;
  outPath: string;
  usedAiRequests: number;
}) {
  const regions = [...opts.masks.textMask, ...opts.masks.variableMask];
  return openaiEdit(
    opts.imagePath,
    regions,
    TEXT_CLEAN_PROMPT,
    opts.outPath,
    opts.usedAiRequests
  );
}

export async function removeFrame(opts: {
  imagePath: string;
  masks: MasksPayload;
  outPath: string;
  usedAiRequests: number;
}) {
  return openaiEdit(
    opts.imagePath,
    opts.masks.frameMask,
    FRAME_REMOVE_PROMPT,
    opts.outPath,
    opts.usedAiRequests
  );
}

export async function extractFrameAsset(opts: {
  imagePath: string;
  frame: FrameAnalysis;
  frameMask: MaskRegion[];
  outPath: string;
}): Promise<{ path?: string; status: "ok" | "needs_review" }> {
  if (!opts.frame.detected || !opts.frame.canExtractAsAsset || opts.frame.confidence < 0.5) {
    return { status: "needs_review" };
  }

  const meta = await sharp(opts.imagePath).metadata();
  const w = meta.width ?? CANVAS_WIDTH;
  const h = meta.height ?? CANVAS_HEIGHT;
  const mask = await buildMaskPng(w, h, opts.frameMask);

  // Keep only masked pixels with alpha
  const rgba = await sharp(opts.imagePath)
    .ensureAlpha()
    .resize(w, h)
    .raw()
    .toBuffer();
  const maskRaw = await sharp(mask).ensureAlpha().raw().toBuffer();
  const out = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const m = maskRaw[i]; // white = keep
    out[i] = rgba[i];
    out[i + 1] = rgba[i + 1];
    out[i + 2] = rgba[i + 2];
    out[i + 3] = m > 128 ? rgba[i + 3] : 0;
  }

  await fs.mkdir(path.dirname(opts.outPath), { recursive: true });
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(opts.outPath);

  return { path: opts.outPath, status: "ok" };
}

export { TEXT_CLEAN_PROMPT, FRAME_REMOVE_PROMPT };
