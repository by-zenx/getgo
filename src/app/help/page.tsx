import { PageHeading } from "@/components/shell/page-heading";
import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function HelpPage() {
  return (
    <>
      <PageHeading title="Help Center" />
      <SectionPlaceholder
        viewName="help"
        title="Knowledge Base & Guides"
        description="Search documentation, fulfillment workflows, and point-of-sale hardware guides."
        icon="help"
      />
    </>
  );
}
