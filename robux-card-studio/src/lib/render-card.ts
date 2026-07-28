import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import type {
  AddedObject,
  EditableTextRegion,
  TextStyle,
} from "@/types/card-studio";
import { CANVAS_HEIGHT, CANVAS_WIDTH, WEBP_QUALITY } from "@/types/card-studio";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleFor(
  region: EditableTextRegion,
  styles: Record<string, TextStyle>
): TextStyle {
  return (
    styles[region.id] ??
    styles[region.role] ?? {
      fontFamily: "Arial, sans-serif",
      fontSize: region.role === "denomination" ? 96 : 42,
      fontWeight: 700,
      color: "#ffffff",
      align: "center",
      lineHeight: 1.1,
      letterSpacing: 0,
      shadow: { color: "rgba(0,0,0,0.55)", blur: 4, offsetX: 0, offsetY: 2 },
    }
  );
}

function textSvg(
  region: EditableTextRegion,
  styles: Record<string, TextStyle>,
  bindings: Record<string, string>
): string {
  const style = styleFor(region, styles);
  const content =
    bindings[region.role] ??
    bindings[region.id] ??
    region.content ??
    "";
  if (!content) return "";

  const anchor =
    style.align === "left"
      ? "start"
      : style.align === "right"
        ? "end"
        : "middle";
  const x =
    style.align === "left"
      ? region.x
      : style.align === "right"
        ? region.x + region.width
        : region.x + region.width / 2;
  const y = region.y + region.height * 0.72;
  const shadow = style.shadow
    ? `<filter id="s-${region.id}" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="${style.shadow.offsetX}" dy="${style.shadow.offsetY}" stdDeviation="${style.shadow.blur / 2}" flood-color="${style.shadow.color}"/>
      </filter>`
    : "";
  const filterAttr = style.shadow ? `filter="url(#s-${region.id})"` : "";
  const stroke = style.stroke
    ? `stroke="${style.stroke.color}" stroke-width="${style.stroke.width}"`
    : "";

  return `${shadow}<text x="${x}" y="${y}" text-anchor="${anchor}"
    font-family="${escapeXml(String(style.fontFamily))}"
    font-size="${style.fontSize}"
    font-weight="${style.fontWeight}"
    fill="${escapeXml(style.color)}"
    letter-spacing="${style.letterSpacing}"
    ${stroke} ${filterAttr}>${escapeXml(String(content))}</text>`;
}

function objectSvg(obj: AddedObject): string {
  switch (obj.type) {
    case "rect":
    case "dim":
      return `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}"
        fill="${escapeXml(String(obj.props.fill ?? "rgba(0,0,0,0.35)"))}"
        opacity="${obj.props.opacity ?? 1}"/>`;
    case "line":
      return `<line x1="${obj.x}" y1="${obj.y}" x2="${obj.x + obj.width}" y2="${obj.y + obj.height}"
        stroke="${escapeXml(String(obj.props.stroke ?? "#fff"))}"
        stroke-width="${obj.props.strokeWidth ?? 3}"/>`;
    case "badge":
      return `<rect x="${obj.x}" y="${obj.y}" rx="12" ry="12" width="${obj.width}" height="${obj.height}"
        fill="${escapeXml(String(obj.props.fill ?? "#111"))}"/>
        <text x="${obj.x + obj.width / 2}" y="${obj.y + obj.height * 0.68}" text-anchor="middle"
        fill="#fff" font-size="${obj.props.fontSize ?? 28}" font-family="Arial">
        ${escapeXml(String(obj.props.text ?? ""))}</text>`;
    case "text":
      return `<text x="${obj.x}" y="${obj.y + (Number(obj.props.fontSize) || 32)}"
        fill="${escapeXml(String(obj.props.fill ?? "#fff"))}"
        font-size="${obj.props.fontSize ?? 32}"
        font-family="${escapeXml(String(obj.props.fontFamily ?? "Arial"))}">
        ${escapeXml(String(obj.props.text ?? ""))}</text>`;
    default:
      return "";
  }
}

export async function renderCard(opts: {
  baseImagePath: string;
  frameAssetPath?: string | null;
  frameEnabled?: boolean;
  textRegions: EditableTextRegion[];
  textStyles: Record<string, TextStyle>;
  addedObjects?: AddedObject[];
  bindings: Record<string, string>;
  outPath: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const width = opts.width ?? CANVAS_WIDTH;
  const height = opts.height ?? CANVAS_HEIGHT;

  const layers: { input: Buffer; left: number; top: number }[] = [];

  if (opts.frameEnabled && opts.frameAssetPath) {
    try {
      const frame = await sharp(opts.frameAssetPath)
        .resize(width, height)
        .png()
        .toBuffer();
      layers.push({ input: frame, left: 0, top: 0 });
    } catch {
      // frame optional
    }
  }

  const objects = [...(opts.addedObjects ?? [])].sort(
    (a, b) => a.zIndex - b.zIndex
  );
  const svgParts = [
    ...opts.textRegions.map((r) => textSvg(r, opts.textStyles, opts.bindings)),
    ...objects.map(objectSvg),
  ].filter(Boolean);

  if (svgParts.length) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgParts.join("")}</svg>`;
    layers.push({ input: Buffer.from(svg), left: 0, top: 0 });
  }

  await fs.mkdir(path.dirname(opts.outPath), { recursive: true });
  await sharp(opts.baseImagePath)
    .resize(width, height, { fit: "cover" })
    .composite(layers)
    .webp({ quality: WEBP_QUALITY })
    .toFile(opts.outPath);

  return opts.outPath;
}

export { FONT_CANDIDATES, suggestFonts } from "@/lib/fonts";
