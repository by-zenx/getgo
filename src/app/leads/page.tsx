import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesView } from "@/components/messages/messages-view";
import { PageHeading } from "@/components/shell/page-heading";

export const metadata: Metadata = { title: "Leads | Corbel" };

async function LeadsContent({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams;
  return <MessagesView initialThreadId={thread} />;
}

export default function LeadsPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  return <>
    <PageHeading title="Leads" />
    <Suspense fallback={null}><LeadsContent searchParams={searchParams} /></Suspense>
  </>;
}
