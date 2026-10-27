import { PageHeading } from "@/components/shell/page-heading";
import { CustomersView } from "@/components/customers/customers-view";

export default function CustomersPage() {
  return (
    <>
      <PageHeading title="Customers" />
      <CustomersView />
    </>
  );
}
