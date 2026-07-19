import { Product } from "@/ai/types/product";
import type { ProductScanRequest } from "@/services/productDiscovery/productScanRequest";

export type TrendProviderResult = {
  products: Product[];
  metadata?: Record<string, unknown>;
};

export interface TrendProvider {
  name: string;
  getProducts(
    request?: ProductScanRequest
  ): Promise<Product[] | TrendProviderResult>;
}
