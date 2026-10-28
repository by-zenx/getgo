import { PageHeading } from "@/components/shell/page-heading";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { createInitialWorkspaceBoards } from "@/data/workspace-data";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects | Corbel" };

export function generateStaticParams() {
  return createInitialWorkspaceBoards().map(({ id }) => ({ boardId: id }));
}

export default async function WorkspaceBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return (
    <>
      <PageHeading title="Projects" />
      <WorkspaceView boardId={boardId} />
    </>
  );
}
