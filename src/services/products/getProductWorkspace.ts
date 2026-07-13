import "server-only";

import {
  getLatestPublication,
  getLatestPublishingPackage,
  getProductById,
  getProductHistory,
  getProductIntelligenceHistory,
  getRelatedProducts,
} from "@/services/repositories/productRepository";

export async function getProductWorkspace(productId: string) {
  const product = await getProductById(productId);

  if (!product) return null;

  const [
    intelligenceHistory,
    publishingPackage,
    publication,
    history,
    relatedProducts,
  ] = await Promise.all([
    getProductIntelligenceHistory(productId),
    getLatestPublishingPackage(productId),
    getLatestPublication(productId),
    getProductHistory(productId, product),
    getRelatedProducts(product),
  ]);

  return {
    product,
    intelligence: intelligenceHistory[0] || null,
    intelligenceHistory,
    publishingPackage,
    publication,
    history,
    relatedProducts,
  };
}

export type ProductWorkspace = NonNullable<
  Awaited<ReturnType<typeof getProductWorkspace>>
>;
