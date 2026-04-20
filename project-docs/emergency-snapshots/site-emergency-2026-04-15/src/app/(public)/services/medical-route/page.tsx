import { ProductPageTemplate } from "@/components/public/product-page";
import { publicProductMap } from "@/features/products/catalog";

const product = publicProductMap["medical-route"];

export default function MedicalRoutePage() {
  return <ProductPageTemplate product={product} />;
}
