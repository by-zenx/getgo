import type { Metadata } from "next";
import { PageHeading } from "@/components/shell/page-heading";
import { ProductsView } from "@/components/products/products-view";
import { createInitialProducts } from "@/data/products-data";

export const metadata: Metadata = { title: "Catalog item | Corbel" };

export function generateStaticParams() {
  return createInitialProducts().map(({ id }) => ({ itemId: id }));
}

export default async function CatalogItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return (
    <>
      <PageHeading title="Catalog" />
      <ProductsView itemId={itemId} />
    </>
  );
}
