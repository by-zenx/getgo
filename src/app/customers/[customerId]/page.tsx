import { CustomersView } from "@/components/customers/customers-view";
import { PageHeading } from "@/components/shell/page-heading";

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;

  return (
    <>
      <PageHeading title="Customers" />
      <CustomersView customerId={customerId} />
    </>
  );
}
