import { ProductPageTemplate } from "@/components/public/product-page";
import { publicProductMap } from "@/features/products/catalog";

const product = publicProductMap["second-opinion"];

export default function SecondOpinionPage() {
  return <ProductPageTemplate product={product} />;
}
