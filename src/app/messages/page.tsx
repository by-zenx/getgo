import { MessagesView } from "@/components/messages/messages-view";
import { PageHeading } from "@/components/shell/page-heading";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams;

  return (
    <>
      <PageHeading title="Messages" />
      <MessagesView initialThreadId={thread} />
    </>
  );
}
