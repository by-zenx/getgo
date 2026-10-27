import { PageHeading } from "@/components/shell/page-heading";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <>
      <PageHeading title="Dashboard" />
      <DashboardView />
    </>
  );
}
