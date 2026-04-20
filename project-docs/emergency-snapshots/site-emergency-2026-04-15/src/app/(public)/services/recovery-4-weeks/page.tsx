import { ProductPageTemplate } from "@/components/public/product-page";
import { publicProductMap } from "@/features/products/catalog";

const product = publicProductMap["recovery-4-weeks"];

export default function RecoveryPage() {
  return <ProductPageTemplate product={product} />;
}
