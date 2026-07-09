import { Product } from "@/ai/types/product";

export interface ProductPublishingInput {
  product: Product;
  brandName: string;
  targetMarket: string;
}

export interface ProductPublishingOutput {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collections: string[];
  handle: string;
  sellPrice: number;
  compareAtPrice: number;
  imageAltText: string;
  validationPassed: boolean;
  validationErrors: string[];
}
