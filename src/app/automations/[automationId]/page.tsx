import { AutomationBuilder } from "@/components/automations/automation-view";
import { createInitialAutomations } from "@/data/automations-data";
import { PageHeading } from "@/components/shell/page-heading";

export function generateStaticParams() {
  return createInitialAutomations().map(({ id }) => ({ automationId: id }));
}

export default async function AutomationDetailPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;

  return (
    <>
      <PageHeading title="Automations" />
      <AutomationBuilder automationId={automationId} />
    </>
  );
}
