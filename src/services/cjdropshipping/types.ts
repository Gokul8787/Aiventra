export interface CJProductListItem {
  id?: string;
  pid?: string;
  nameEn?: string;
  productNameEn?: string;
  sku?: string;
  productSku?: string;
  bigImage?: string;
  productImage?: string;
  productUrl?: string;
  sellPrice?: string;
  nowPrice?: string;
  discountPrice?: string;
  listedNum?: number;
  listingCount?: number;
  inventoryNum?: number;
  categoryId?: string;
  categoryName?: string;
  threeCategoryName?: string;
  twoCategoryName?: string;
  oneCategoryName?: string;
  supplierName?: string;
  warehouseInventoryNum?: number;
  deliveryCycle?: string;
}

export interface CJProductListResponse {
  code: number;
  result: boolean;
  message: string;
  data?: {
    pageNum?: number;
    pageSize?: number;
    total?: number;
    list?: CJProductListItem[];
  };
}
