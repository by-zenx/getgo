import { PageHeading } from "@/components/shell/page-heading";
import { AutomationListView } from "@/components/automations/automation-view";

export default function AutomationsPage() {
  return (
    <>
      <PageHeading title="Automations" />
      <AutomationListView />
    </>
  );
}
