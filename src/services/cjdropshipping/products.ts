import { cjFetch } from "./client";
import { CJProductListItem, CJProductListResponse } from "./types";

export async function getCJProducts(
  keyword = "pet"
): Promise<CJProductListItem[]> {
  const params = new URLSearchParams({
    pageNum: "1",
    pageSize: "20",
    productNameEn: keyword,
  });

  const data = (await cjFetch(`/product/list?${params.toString()}`, {
    method: "GET",
  })) as CJProductListResponse;

  if (data.code !== 200 || !data.data?.list) {
    throw new Error(data.message || "Failed to fetch CJ products");
  }

  return data.data.list;
}
