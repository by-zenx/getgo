import type { Metadata } from "next";
import { PageHeading } from "@/components/shell/page-heading";
import { PipelineView } from "@/components/pipeline/pipeline-view";

export const metadata: Metadata = { title: "Pipeline | Corbel" };

export default function PipelinePage() {
  return <><PageHeading title="Pipeline" animate={false} /><PipelineView /></>;
}
