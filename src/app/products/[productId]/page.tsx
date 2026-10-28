import { PageHeading } from "@/components/shell/page-heading";
import { ProductsView } from "@/components/products/products-view";
import { createInitialProducts } from "@/data/products-data";

export function generateStaticParams() {
  return createInitialProducts().map(({ id }) => ({ productId: id }));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return (
    <>
      <PageHeading title="Products" />
      <ProductsView productId={productId} />
    </>
  );
}
