import { PageHeading } from "@/components/shell/page-heading";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export default async function WorkspaceBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return (
    <>
      <PageHeading title="Workspace" />
      <WorkspaceView boardId={boardId} />
    </>
  );
}
