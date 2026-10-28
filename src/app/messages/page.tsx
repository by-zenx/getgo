import { Suspense } from "react";
import { MessagesView } from "@/components/messages/messages-view";
import { PageHeading } from "@/components/shell/page-heading";

async function MessagesContent({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams;
  return <MessagesView initialThreadId={thread} />;
}

export default function MessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  return (
    <>
      <PageHeading title="Messages" />
      <Suspense fallback={null}><MessagesContent searchParams={searchParams} /></Suspense>
    </>
  );
}
