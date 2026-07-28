import { DigitizeWizard } from "@/components/digitize/digitize-wizard";

type Props = { params: Promise<{ sku: string }> };

export default async function DigitizePage({ params }: Props) {
  const { sku } = await params;
  return <DigitizeWizard sku={sku} />;
}
