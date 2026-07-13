import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";
import { Product } from "@/ai/types/product";
import { ProductIntelligence } from "@/ai/intelligence/productIntelligenceTypes";

export type WorkspaceProduct = Product & {
  databaseId: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type IntelligenceHistoryItem = {
  id: string;
  overallScore: number;
  calculatedAt: string;
  intelligence: ProductIntelligence | null;
};

export type PublishingPackageRecord = {
  id: string;
  title: string;
  descriptionHtml: string;
  seoTitle?: string;
  seoDescription?: string;
  handle: string;
  tags: string[];
  collections: string[];
  sellPrice: number;
  compareAtPrice?: number;
  imageAltText?: string;
  validationPassed: boolean;
  validationErrors: string[];
  createdAt: string;
};

export type PublicationRecord = {
  id: string;
  platform: string;
  externalProductId?: string;
  externalUrl?: string;
  status: "draft" | "active" | "archived" | "failed";
  errorMessage?: string;
  publishedAt?: string;
  createdAt: string;
};

export type ProductHistorySummary = {
  firstSeenAt: string;
  lastSeenAt: string;
  timesScanned: number;
  timesRecommended: number;
  latestScanAt?: string;
  latestAIScore?: number;
};

export type RelatedProduct = {
  databaseId: string;
  name: string;
  category?: string;
  supplier?: string;
  imageUrl?: string;
  aiScore?: number;
};

type ProductDatabaseRow = {
  id: string;
  raw_data: Product;
  name: string;
  category: string | null;
  supplier: string | null;
  provider: string;
  image_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export async function getProductById(
  productId: string
): Promise<WorkspaceProduct | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      `
        id,
        raw_data,
        name,
        category,
        supplier,
        provider,
        image_url,
        first_seen_at,
        last_seen_at
      `
    )
    .eq("id", productId)
    .maybeSingle<ProductDatabaseRow>();

  if (error) {
    throw new Error(`Failed to load product: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data.raw_data,
    databaseId: data.id,
    name: data.raw_data.name || data.name,
    category: data.raw_data.category || data.category || "General",
    supplier: data.raw_data.supplier || data.supplier || data.provider,
    imageUrl: data.raw_data.imageUrl || data.image_url || undefined,
    firstSeenAt: data.first_seen_at,
    lastSeenAt: data.last_seen_at,
  };
}

export async function getProductIntelligenceHistory(
  productId: string,
  limit = 20
): Promise<IntelligenceHistoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from("product_intelligence")
    .select("id, overall_score, analysis, calculated_at")
    .eq("product_id", productId)
    .order("calculated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load product intelligence: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    overallScore: Number(row.overall_score || 0),
    calculatedAt: row.calculated_at,
    intelligence: (row.analysis as ProductIntelligence | null) || null,
  }));
}

export async function getLatestPublishingPackage(
  productId: string
): Promise<PublishingPackageRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("publishing_packages")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load publishing package: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    descriptionHtml: data.description_html,
    seoTitle: data.seo_title || undefined,
    seoDescription: data.seo_description || undefined,
    handle: data.handle,
    tags: data.tags || [],
    collections: data.collections || [],
    sellPrice: Number(data.sell_price),
    compareAtPrice:
      data.compare_at_price == null ? undefined : Number(data.compare_at_price),
    imageAltText: data.image_alt_text || undefined,
    validationPassed: data.validation_passed,
    validationErrors: data.validation_errors || [],
    createdAt: data.created_at,
  };
}

export async function getLatestPublication(
  productId: string
): Promise<PublicationRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("product_publications")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load product publication: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    platform: data.platform,
    externalProductId: data.external_product_id || undefined,
    externalUrl: data.external_url || undefined,
    status: data.status,
    errorMessage: data.error_message || undefined,
    publishedAt: data.published_at || undefined,
    createdAt: data.created_at,
  };
}

export async function getProductHistory(
  productId: string,
  product: WorkspaceProduct
): Promise<ProductHistorySummary> {
  const { data, error } = await supabaseAdmin
    .from("scan_products")
    .select(
      `
        recommended,
        product_scans (
          started_at
        )
      `
    )
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Failed to load product scan history: ${error.message}`);
  }

  const rows = data || [];

  const scanDates = rows
    .map((row) => {
      const scan = Array.isArray(row.product_scans)
        ? row.product_scans[0]
        : row.product_scans;

      return scan?.started_at as string | undefined;
    })
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const { data: latestIntelligence, error: intelligenceError } =
    await supabaseAdmin
      .from("product_intelligence")
      .select("overall_score")
      .eq("product_id", productId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (intelligenceError) {
    throw new Error(
      `Failed to load latest intelligence: ${intelligenceError.message}`
    );
  }

  return {
    firstSeenAt: product.firstSeenAt,
    lastSeenAt: product.lastSeenAt,
    timesScanned: rows.length,
    timesRecommended: rows.filter((row) => row.recommended === true).length,
    latestScanAt: scanDates[0],
    latestAIScore:
      latestIntelligence?.overall_score == null
        ? undefined
        : Number(latestIntelligence.overall_score),
  };
}

export async function getRelatedProducts(
  product: WorkspaceProduct,
  limit = 5
): Promise<RelatedProduct[]> {
  let query = supabaseAdmin
    .from("products")
    .select("id, name, category, supplier, provider, image_url, raw_data")
    .neq("id", product.databaseId)
    .limit(20);

  if (product.category) {
    query = query.eq("category", product.category);
  } else if (product.supplier) {
    query = query.eq("supplier", product.supplier);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load related products: ${error.message}`);
  }

  const candidates = data || [];

  if (candidates.length === 0) return [];

  const ids = candidates.map((row) => row.id);

  const { data: intelligenceRows, error: intelligenceError } =
    await supabaseAdmin
      .from("product_intelligence")
      .select("product_id, overall_score, calculated_at")
      .in("product_id", ids)
      .order("calculated_at", { ascending: false });

  if (intelligenceError) {
    throw new Error(
      `Failed to load related-product scores: ${intelligenceError.message}`
    );
  }

  const latestScoreByProduct = new Map<string, number>();

  for (const row of intelligenceRows || []) {
    if (!latestScoreByProduct.has(row.product_id)) {
      latestScoreByProduct.set(row.product_id, Number(row.overall_score || 0));
    }
  }

  return candidates
    .map((row) => {
      const rawData = row.raw_data as Product;

      return {
        databaseId: row.id,
        name: rawData.name || row.name,
        category: rawData.category || row.category || undefined,
        supplier: rawData.supplier || row.supplier || row.provider || undefined,
        imageUrl: rawData.imageUrl || row.image_url || undefined,
        aiScore: latestScoreByProduct.get(row.id),
      };
    })
    .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
    .slice(0, limit);
}
