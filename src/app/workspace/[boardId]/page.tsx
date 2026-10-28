import { PageHeading } from "@/components/shell/page-heading";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { createInitialWorkspaceBoards } from "@/data/workspace-data";

export function generateStaticParams() {
  return createInitialWorkspaceBoards().map(({ id }) => ({ boardId: id }));
}

export default async function WorkspaceBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return (
    <>
      <PageHeading title="Workspace" />
      <WorkspaceView boardId={boardId} />
    </>
  );
}
