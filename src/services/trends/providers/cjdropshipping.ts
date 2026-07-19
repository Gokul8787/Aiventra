import { TrendProvider } from "../types";
import type { ProductScanRequest } from "@/services/productDiscovery/productScanRequest";
import { discoverCJProducts } from "@/services/productDiscovery/discoverCJProducts";

export const cjDropshippingProvider: TrendProvider = {
  name: "CJ Dropshipping",

  async getProducts(request?: ProductScanRequest) {
    const discovery = await discoverCJProducts(request || { mode: "broad" });

    return {
      products: discovery.products,
      metadata: {
        queries: discovery.sources,
        rejectedCount: discovery.rejectedCount,
        stats: discovery.stats,
        diagnostic: {
          rawProductFieldNames: discovery.rawProductFieldNames,
        },
        rejectionSummary: discovery.rejectionSummary,
        warningSummary: discovery.warningSummary,
        rejectionSamples: discovery.rejectionSamples,
      },
    };
  },
};
