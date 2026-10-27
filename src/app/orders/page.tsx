import { PageHeading } from "@/components/shell/page-heading";
import { OrdersView } from "@/components/orders/orders-view";

export default function OrdersPage() {
  return (
    <>
      <PageHeading title="Orders" />
      <OrdersView />
    </>
  );
}
