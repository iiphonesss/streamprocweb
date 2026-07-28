import { prisma } from "@/lib/db";
import type { ProcessingStatus } from "@/types/card-studio";

export async function getProductStatus(
  sku: string
): Promise<ProcessingStatus> {
  const cards = await prisma.generatedCard.count({
    where: { productSku: sku },
  });
  if (cards > 0) return "has_cards";

  const templateCards = await prisma.cardTemplate.findMany({
    where: { sourceSku: sku },
    select: { id: true },
  });
  if (templateCards.length) {
    const ids = templateCards.map((t) => t.id);
    const byTemplate = await prisma.generatedCard.count({
      where: { templateId: { in: ids } },
    });
    if (byTemplate > 0) return "has_cards";
    return "template_saved";
  }

  const dig = await prisma.digitizationResult.findFirst({
    where: { productSku: sku },
    orderBy: { updatedAt: "desc" },
  });
  if (!dig) return "unprocessed";
  if (dig.cleanWithFramePath || dig.cleanWithoutFramePath) return "base_created";
  if (dig.textRegionsJson || dig.masksJson) return "analyzed";
  return "unprocessed";
}
