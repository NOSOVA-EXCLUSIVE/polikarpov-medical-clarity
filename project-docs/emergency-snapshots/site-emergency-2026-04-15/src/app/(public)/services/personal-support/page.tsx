import { ProductPageTemplate } from "@/components/public/product-page";
import { publicProductMap } from "@/features/products/catalog";

const product = publicProductMap["personal-support"];

export default function PersonalSupportPage() {
  return <ProductPageTemplate product={product} />;
}
