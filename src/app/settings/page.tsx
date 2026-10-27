import { PageHeading } from "@/components/shell/page-heading";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <>
      <PageHeading title="Settings" />
      <SettingsView />
    </>
  );
}
