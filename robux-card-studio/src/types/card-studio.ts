export type TextRole =
  | "title"
  | "denomination"
  | "currency"
  | "country"
  | "footer"
  | "other";

export type MaskRole =
  | "text"
  | "variable"
  | "frame"
  | "preserve";

export type BaseMode =
  | "original"
  | "clean_with_frame"
  | "clean_without_frame";

export type ProcessingStatus =
  | "unprocessed"
  | "analyzed"
  | "base_created"
  | "template_saved"
  | "has_cards";

export type FrameType =
  | "outer"
  | "inner"
  | "rounded"
  | "glow"
  | "shadow"
  | "decorative"
  | "unknown";

export type FrameAnalysis = {
  detected: boolean;
  frameType: FrameType;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  thickness?: number;
  radius?: number;
  color?: string;
  opacity?: number;
  confidence: number;
  canExtractAsAsset: boolean;
  warnings: string[];
};

export type EditableTextRegion = {
  id: string;
  role: TextRole;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  confidence: number;
};

export type MaskRegion = {
  id: string;
  role: MaskRole;
  variableRole?: TextRole;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type MasksPayload = {
  textMask: MaskRegion[];
  variableMask: MaskRegion[];
  frameMask: MaskRegion[];
  preserveMask: MaskRegion[];
};

export type AnalysisSummary = {
  foundDenomination: boolean;
  foundCurrency: boolean;
  foundFrame: boolean;
  foundMainObject: boolean;
  foundTextAreas: boolean;
  backgroundType: string;
  notes: string[];
};

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  stroke?: {
    color: string;
    width: number;
  };
  fontCandidates?: string[];
};

export type AddedObject = {
  id: string;
  type:
    | "text"
    | "image"
    | "logo"
    | "flag"
    | "badge"
    | "line"
    | "rect"
    | "dim";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  props: Record<string, unknown>;
};

export type CardTemplateDefinition = {
  id: string;
  name: string;
  sourceSku: string;
  baseMode: BaseMode;
  baseImagePath: string;
  frameAssetPath?: string;
  frameEnabled: boolean;
  textRegions: EditableTextRegion[];
  textStyles: Record<string, TextStyle>;
  addedObjects: AddedObject[];
  canvas: {
    width: number;
    height: number;
  };
};

export type CatalogProductInput = {
  sku: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  faceValue?: number | string | null;
  faceCurrency?: string | null;
  description?: string | null;
  images?: string[];
  isActive?: boolean;
  [key: string]: unknown;
};

export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 1536;
export const WEBP_QUALITY = 90;

export const STATUS_LABELS: Record<ProcessingStatus, string> = {
  unprocessed: "Не обработан",
  analyzed: "Проанализирован",
  base_created: "Основа создана",
  template_saved: "Шаблон сохранён",
  has_cards: "Есть готовые карточки",
};
