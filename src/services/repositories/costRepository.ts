import "server-only";

import type { CostAnalysis } from "@/ai/cost/types";
import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

type CostSnapshotRow = {
  product_id: string;
  analysis: CostAnalysis | null;
};

export async function saveProductCostSnapshots(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    const cost = product.costAnalysis;

    if (!cost) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    return [
      {
        ...tenantColumns(input.tenantContext),
        scan_id: input.scanId,
        product_id: persistedProduct.id,

        calculation_type: cost.calculationType,
        currency: cost.currency,

        revenue: cost.revenue,

        supplier_cost: cost.costs.supplierCost,
        shipping_cost: cost.costs.shippingCost,
        payment_fee: cost.costs.paymentFee,
        platform_fee_allocation: cost.costs.platformFeeAllocation,
        advertising_cost: cost.costs.advertisingCost,
        return_allowance: cost.costs.returnAllowance,
        currency_conversion_fee: cost.costs.currencyConversionFee,
        vat_reserve: cost.costs.vatReserve,
        other_costs: cost.costs.otherCosts,

        total_non_advertising_cost: cost.totalNonAdvertisingCost,
        total_cost: cost.totalCost,

        gross_profit: cost.grossProfit,
        pre_advertising_profit: cost.preAdvertisingProfit,
        net_profit: cost.netProfit,

        gross_margin_percent: cost.grossMarginPercent,
        net_margin_percent: cost.netMarginPercent,
        roi_percent: cost.roiPercent,
        break_even_roas: cost.breakEvenROAS,
        maximum_affordable_cpa: cost.maximumAffordableCPA,

        profit_score: cost.profitScore,
        financially_viable: cost.financiallyViable,

        engine_version: cost.engineVersion,
        analysis: cost,
        calculated_at: cost.calculatedAt,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from("product_cost_snapshots")
    .insert(rows);

  if (error) {
    throw new Error(`Failed to save product costs: ${error.message}`);
  }
}

export async function getCostAnalysisByScanProduct(input: {
  tenantContext: TenantContext;
  scanId: string;
  productIds: string[];
}): Promise<Map<string, CostAnalysis>> {
  if (input.productIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("product_cost_snapshots")
    .select("product_id, analysis")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("scan_id", input.scanId)
    .in("product_id", input.productIds);

  if (error) {
    throw new Error(`Failed to load product costs: ${error.message}`);
  }

  return new Map(
    ((data || []) as CostSnapshotRow[]).flatMap((row) =>
      row.analysis ? [[row.product_id, row.analysis]] : []
    )
  );
}

export async function getLatestCostAnalysis(
  tenantContext: TenantContext,
  productId: string
): Promise<CostAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from("product_cost_snapshots")
    .select("analysis")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("product_id", productId)
    .order("calculated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle<{ analysis: CostAnalysis | null }>();

  if (error) {
    throw new Error(`Failed to load cost analysis: ${error.message}`);
  }

  return data?.analysis ?? null;
}
