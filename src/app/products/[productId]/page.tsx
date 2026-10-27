import { PageHeading } from "@/components/shell/page-heading";
import { ProductsView } from "@/components/products/products-view";

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return (
    <>
      <PageHeading title="Products" />
      <ProductsView productId={productId} />
    </>
  );
}
