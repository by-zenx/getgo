import type { Metadata } from "next";
import { PageHeading } from "@/components/shell/page-heading";
import { ProductsView } from "@/components/products/products-view";

export const metadata: Metadata = { title: "Catalog | Corbel" };

export default function CatalogPage() {
  return (
    <>
      <PageHeading title="Catalog" />
      <ProductsView />
    </>
  );
}
