import { AutomationBuilder } from "@/components/automations/automation-view";
import { PageHeading } from "@/components/shell/page-heading";

export default async function AutomationDetailPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;

  return (
    <>
      <PageHeading title="Automations" />
      <AutomationBuilder automationId={automationId} />
    </>
  );
}
