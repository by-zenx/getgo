import { Suspense } from "react";
import { redirect } from "next/navigation";

async function LegacyMessagesRedirect({ searchParams }: { searchParams: Promise<{ thread?: string }> }): Promise<never> {
  const { thread } = await searchParams;
  return redirect(`/leads${thread ? `?thread=${encodeURIComponent(thread)}` : ""}`);
}

export default function LegacyMessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  return <Suspense fallback={null}><LegacyMessagesRedirect searchParams={searchParams} /></Suspense>;
}
