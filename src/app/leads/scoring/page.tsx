import type { Metadata } from "next";
import { ScoringView } from "@/components/messages/scoring-view";
import { PageHeading } from "@/components/shell/page-heading";

export const metadata: Metadata = { title: "Lead scoring | Corbel" };

export default function LeadScoringPage() {
  return <>
    <PageHeading title="Leads" />
    <ScoringView />
  </>;
}
