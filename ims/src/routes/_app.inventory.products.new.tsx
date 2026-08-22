import { ProductFormPage } from "@/components/inventory/product-form-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/inventory/products/new")({
  head: () => ({
    meta: [
      { title: "Add Product — SROTA IMS" },
      {
        name: "description",
        content: "Add a new product with variants, pricing, category, brand and opening stock.",
      },
    ],
  }),
  component: () => <ProductFormPage />,
});
