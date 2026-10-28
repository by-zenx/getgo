import type { Metadata } from "next";
import { PageHeading } from "@/components/shell/page-heading";
import { PipelineInsightsView } from "@/components/pipeline/pipeline-insights-view";

export const metadata: Metadata = { title: "Pipeline Insights | Corbel" };

export default function PipelineInsightsPage() {
  return <><PageHeading title="Pipeline" animate={false} /><PipelineInsightsView /></>;
}
