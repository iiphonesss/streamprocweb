-- CreateTable
CREATE TABLE "ImportedProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "faceValue" DECIMAL,
    "faceCurrency" TEXT,
    "description" TEXT,
    "images" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rawData" JSONB NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DigitizationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productSku" TEXT NOT NULL,
    "sourceImageUrl" TEXT NOT NULL,
    "originalPath" TEXT,
    "cleanWithFramePath" TEXT,
    "cleanWithoutFramePath" TEXT,
    "frameAssetPath" TEXT,
    "frameAnalysisJson" JSONB,
    "textRegionsJson" JSONB,
    "masksJson" JSONB,
    "selectedBaseMode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "frameExtractionStatus" TEXT,
    "analysisSummaryJson" JSONB,
    "aiRequestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceSku" TEXT NOT NULL,
    "digitizationId" TEXT,
    "baseMode" TEXT NOT NULL,
    "baseImagePath" TEXT NOT NULL,
    "frameAssetPath" TEXT,
    "frameEnabled" BOOLEAN NOT NULL DEFAULT true,
    "canvasJson" JSONB NOT NULL,
    "textRegionsJson" JSONB NOT NULL,
    "textStylesJson" JSONB NOT NULL,
    "addedObjectsJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GeneratedCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "productSku" TEXT,
    "dataJson" JSONB NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedProduct_sku_key" ON "ImportedProduct"("sku");

-- CreateIndex
CREATE INDEX "DigitizationResult_productSku_idx" ON "DigitizationResult"("productSku");

-- CreateIndex
CREATE INDEX "CardTemplate_sourceSku_idx" ON "CardTemplate"("sourceSku");

-- CreateIndex
CREATE INDEX "GeneratedCard_templateId_idx" ON "GeneratedCard"("templateId");
