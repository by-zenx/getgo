import { PageHeading } from "@/components/shell/page-heading";
import { ProductsView } from "@/components/products/products-view";

export default function ProductsPage() {
  return (
    <>
      <PageHeading title="Products" />
      <ProductsView />
    </>
  );
}
