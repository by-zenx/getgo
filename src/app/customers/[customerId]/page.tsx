import { CustomersView } from "@/components/customers/customers-view";
import { createInitialCustomers } from "@/data/customers-data";
import { PageHeading } from "@/components/shell/page-heading";

export function generateStaticParams() {
  return createInitialCustomers().map(({ id }) => ({ customerId: id }));
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;

  return (
    <>
      <PageHeading title="Customers" />
      <CustomersView customerId={customerId} />
    </>
  );
}
