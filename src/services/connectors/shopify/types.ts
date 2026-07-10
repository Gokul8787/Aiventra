export interface ShopifyProductCreateRequest {
  product: {
    title: string;
    body_html: string;
    handle: string;
    tags: string;
    variants: Array<{
      price: string;
      compare_at_price?: string;
    }>;
  };
}
