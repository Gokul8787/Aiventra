import { Product } from "@/ai/types/product";

export interface TrendProvider {
  name: string;
  getProducts(): Promise<Product[]>;
}
