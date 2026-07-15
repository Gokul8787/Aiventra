import type { TenantContext } from "@/context/storeContext";

export interface PublishProductInput {
  title: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  tags: string[];
  collections: string[];
  handle: string;
  imageUrl?: string;
  imageAltText?: string;
  seoTitle?: string;
  seoDescription?: string;
  productType?: string;
  vendor?: string;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  externalVariantId?: string;
  externalUrl?: string;
  message?: string;
}

export interface EcommerceConnector {
  name: string;

  publishProduct(
    tenantContext: TenantContext,
    product: PublishProductInput
  ): Promise<PublishResult>;
}
