import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeading } from "@/components/shell/page-heading";
import { SettingsView } from "@/components/settings/settings-view";

async function SettingsContent() {
  // Settings derives invoice dates from the current time during render.
  await connection();
  return <SettingsView />;
}

export default function SettingsPage() {
  return (
    <>
      <PageHeading title="Settings" />
      <Suspense fallback={null}><SettingsContent /></Suspense>
    </>
  );
}
