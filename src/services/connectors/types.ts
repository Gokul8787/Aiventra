export interface PublishProductInput {
  title: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  tags: string[];
  collections: string[];
  handle: string;
  imageUrl?: string;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  message?: string;
}

export interface EcommerceConnector {
  name: string;

  publishProduct(product: PublishProductInput): Promise<PublishResult>;
}
