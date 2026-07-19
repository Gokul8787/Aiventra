import "server-only";

import { cjFetch } from "./client";
import { CJProductListItem, CJProductListResponse } from "./types";
import { acquireCJPermit } from "@/services/providers/cj/cjRateLimiter";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCJPermit() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const permit = await acquireCJPermit();

    if (permit.granted) return;

    if (permit.retryAfterMs > 0) {
      await wait(permit.retryAfterMs);
    }
  }

  throw new Error("CJ request permit was not granted.");
}

export async function getCJProducts(keyword: string): Promise<CJProductListItem[]> {
  await waitForCJPermit();

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
