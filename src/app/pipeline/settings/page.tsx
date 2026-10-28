import type { Metadata } from "next";
import { Icon } from "@/components/icons/svg-sprite";
import { PageHeading } from "@/components/shell/page-heading";

export const metadata: Metadata = { title: "Pipeline Settings | Corbel" };

export default function PipelineSettingsPage() {
  return <><PageHeading title="Pipeline" animate={false} /><section className="view" data-view="pipeline-settings"><div className="card empty"><Icon name="gear" /><b>Pipeline settings</b><span>Coming soon</span></div></section></>;
}
