import { TrendProvider } from "../types";
import { Product } from "@/ai/types/product";
import { getCJProducts } from "@/services/cjdropshipping/products";
import { normalizeCJProduct } from "@/services/normalizers/cjNormalizer";

export const cjDropshippingProvider: TrendProvider = {
  name: "CJ Dropshipping",

  async getProducts(): Promise<Product[]> {
    const cjProducts = await getCJProducts("pet");

    return cjProducts.slice(0, 10).map(normalizeCJProduct);
  },
};
