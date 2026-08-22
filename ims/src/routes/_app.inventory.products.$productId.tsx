import { ProductFormPage } from "@/components/inventory/product-form-page";
import { EmptyState, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/inventory/products/$productId")({
  head: () => ({
    meta: [{ title: "Edit Product — SROTA IMS" }],
  }),
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = useParams({ from: "/_app/inventory/products/$productId" });
  const app = useApp();
  const product = app.products.find((p) => p.id === productId);

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Product not found"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/inventory/products">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to products
              </Link>
            </Button>
          }
        />
        <EmptyState
          title="This product isn't loaded"
          description="It may have been deleted, or hasn't loaded into the catalogue yet — go back and open it from the list."
        />
      </div>
    );
  }

  return <ProductFormPage product={product} />;
}
