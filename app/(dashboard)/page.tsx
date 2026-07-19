"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Product } from "@/ai/types/product";
import { createTenantHeaders } from "@/context/apiHeaders";
import type { TenantContext } from "@/multiTenant/types";
import type { ProviderHealth } from "@/evidence/types";
import {
  PRODUCT_LIFECYCLE_LABELS,
  ProductLifecycleStage,
} from "@/lifecycle/ProductLifecycle";
import { DISCOVERY_CATEGORIES } from "@/services/productDiscovery/discoveryConfig";

type DiscoveryMode = "broad" | "category" | "keyword";

type CJDiscoveryStats = {
  queriesCompleted: number;
  queriesPlanned: number;
  categoriesCovered: number;
  rawProducts: number;
  uniqueProducts: number;
  passedFirstFilter: number;
  rejectedCount: number;
};

type SourceStatus = {
  name: string;
  status: "success" | "failed" | "skipped";
  count: number;
  error?: string;
  metadata?: {
    stats?: CJDiscoveryStats;
    rejectedCount?: number;
  };
};

type RecentScan = {
  id: string;
  status: "running" | "completed" | "failed";
  totalFound: number;
  totalRecommended: number;
  startedAt: string;
  completedAt?: string;
  providers: SourceStatus[];
};

type MemoryDashboard = {
  mostSeen: NonNullable<Product["memory"]>[];
  mostPublished: NonNullable<Product["memory"]>[];
  highestConfidence: NonNullable<Product["memory"]>[];
  fastestGrowing: NonNullable<Product["memory"]>[];
};

type PublishingPackage = {
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
};

type ProductPublishStatus = {
  success: boolean;
  message: string;
  externalUrl?: string;
};

type BackgroundJob = {
  id: string;
  status:
    | "queued"
    | "running"
    | "retrying"
    | "completed"
    | "failed"
    | "cancelled"
    | "dead_letter";
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  resultReference?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

function getRequestHeaders(context?: TenantContext | null): HeadersInit {
  return context
    ? createTenantHeaders(context.organisationId, context.storeId)
    : {
        "Content-Type": "application/json",
      };
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("broad");
  const [selectedCategory, setSelectedCategory] = useState(
    DISCOVERY_CATEGORIES[0]?.id || "home-kitchen"
  );
  const [keyword, setKeyword] = useState("");
  const [totalProducts, setTotalProducts] = useState(0);
  const [recommendedProducts, setRecommendedProducts] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [publishingLoading, setPublishingLoading] = useState(false);
  const [publishingPackage, setPublishingPackage] =
    useState<PublishingPackage | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] =
    useState<ProductPublishStatus | null>(null);
  const [productPublishStatuses, setProductPublishStatuses] = useState<
    Record<string, ProductPublishStatus>
  >({});
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<BackgroundJob | null>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(
    null
  );
  const [memoryDashboard, setMemoryDashboard] = useState<MemoryDashboard>({
    mostSeen: [],
    mostPublished: [],
    highestConfidence: [],
    fastestGrowing: [],
  });

  const refreshDashboardData = useCallback(async (context?: TenantContext) => {
    const headers = getRequestHeaders(context);
    const [latestResponse, scansResponse] = await Promise.all([
      fetch("/api/history/latest-recommendations", {
        cache: "no-store",
        headers,
      }),
      fetch("/api/history/product-scans", {
        cache: "no-store",
        headers,
      }),
    ]);

    const latestData = await latestResponse.json();
    const scansData = await scansResponse.json();

    if (latestResponse.ok && latestData.success) {
      setTenantContext(latestData.tenantContext || null);
      setProducts(latestData.products || []);
      setSources(latestData.sources || []);
      setProviderHealth(latestData.providerHealth || []);
      setTotalProducts(latestData.totalProducts ?? 0);
      setRecommendedProducts(latestData.recommendedProducts ?? 0);
      setMemoryDashboard(
        latestData.memoryDashboard || {
          mostSeen: [],
          mostPublished: [],
          highestConfidence: [],
          fastestGrowing: [],
        }
      );
    }

    if (scansResponse.ok && scansData.success) {
      setTenantContext((current) => current || scansData.tenantContext || null);
      setRecentScans(scansData.scans || []);
    }
  }, []);

  const runAI = useCallback(async () => {
    try {
      setLoading(true);
      setScanError(null);
      setJobProgress(null);

      const response = await fetch("/api/jobs/product-scan", {
        method: "POST",
        headers: getRequestHeaders(tenantContext),
        body: JSON.stringify({
          mode: discoveryMode,
          categoryId:
            discoveryMode === "category" ? selectedCategory : undefined,
          keyword:
            discoveryMode === "keyword" ? keyword.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to queue Product Hunter.");
      }

      setTenantContext((current) => data.tenantContext || current);
      setActiveJobId(data.jobId);
      setJobProgress({
        id: data.jobId,
        status: "queued",
        progress: 0,
        currentStep: "Queued",
        resultReference: {},
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setActiveJobId(null);
      setJobProgress(null);
      setScanError(
        error instanceof Error ? error.message : "Product Hunter failed."
      );
      setLoading(false);
    }
  }, [discoveryMode, keyword, selectedCategory, tenantContext]);

  const loadSavedDashboard = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const contextResponse = await fetch("/api/context/store", {
        cache: "no-store",
      });
      const contextData = await contextResponse.json();

      if (contextResponse.ok && contextData.success) {
        setTenantContext(contextData.tenantContext);
      }

      await refreshDashboardData(contextData.tenantContext);

      const activeJobResponse = await fetch("/api/jobs/active", {
        cache: "no-store",
        headers: getRequestHeaders(contextData.tenantContext),
      });
      const activeJobData = await activeJobResponse.json();

      if (activeJobResponse.ok && activeJobData.success && activeJobData.job) {
        setActiveJobId(activeJobData.job.id);
        setJobProgress(activeJobData.job);
        setLoading(true);
      }
    } catch (error) {
      console.error("Failed to load saved dashboard:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [refreshDashboardData]);

  async function generatePublishing(product: Product) {
    try {
      setPublishingLoading(true);
      setPublishingPackage(null);
      setPublishResult(null);
      setSelectedProduct(product);

      const response = await fetch("/api/ai/publishing", {
        method: "POST",
        headers: getRequestHeaders(tenantContext),
        body: JSON.stringify({ product }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Publishing package generation failed.");
      }

      setPublishingPackage(data.publishingPackage);

      if (data.product) {
        setSelectedProduct(data.product);
        setProducts((current) =>
          current.map((item) =>
            item.id === data.product.id ? { ...item, ...data.product } : item
          )
        );
      }
    } catch (error) {
      setPublishResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Publishing package generation failed.",
      });
    } finally {
      setPublishingLoading(false);
    }
  }

  async function publishSelectedProduct() {
    if (!selectedProduct || !publishingPackage) {
      setPublishResult({
        success: false,
        message: "Generate and review a listing before publishing.",
      });
      return;
    }

    if (!publishingPackage.validationPassed) {
      setPublishResult({
        success: false,
        message: "This listing failed validation and cannot be published.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Create "${publishingPackage.title}" as a DRAFT product in Shopify?\n\n` +
        `Selling price: £${publishingPackage.sellPrice}\n` +
        `Compare-at price: £${publishingPackage.compareAtPrice}`
    );

    if (!confirmed) return;

    const productToPublish = selectedProduct;

    try {
      setPublishLoading(true);
      setPublishResult(null);

      const response = await fetch("/api/connectors/shopify/publish", {
        method: "POST",
        headers: getRequestHeaders(tenantContext),
        body: JSON.stringify({
          product: selectedProduct,
          publishingPackage,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Shopify draft publishing failed.");
      }

      const successfulResult: ProductPublishStatus = {
        success: true,
        message:
          data.result?.message || "The product was created as a Shopify draft.",
        externalUrl: data.result?.externalUrl,
      };

      setPublishResult(successfulResult);

      if (data.product) {
        setSelectedProduct(data.product);
        setProducts((current) =>
          current.map((item) =>
            item.id === data.product.id ? { ...item, ...data.product } : item
          )
        );
      }

      setProductPublishStatuses((current) => ({
        ...current,
        [productToPublish.id]: successfulResult,
      }));
    } catch (error) {
      const failedResult: ProductPublishStatus = {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Shopify draft publishing failed.",
      };

      setPublishResult(failedResult);

      setProductPublishStatuses((current) => ({
        ...current,
        [productToPublish.id]: failedResult,
      }));
    } finally {
      setPublishLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSavedDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSavedDashboard]);

  useEffect(() => {
    if (!activeJobId) return;

    let cancelled = false;

    async function pollJob() {
      try {
        const response = await fetch(`/api/jobs/${activeJobId}`, {
          cache: "no-store",
          headers: getRequestHeaders(tenantContext),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load job status.");
        }

        if (cancelled) return;

        const job = data.job as BackgroundJob;
        setJobProgress(job);

        if (isTerminalJobStatus(job.status)) {
          setActiveJobId(null);
          setLoading(false);

          if (job.status === "completed") {
            await refreshDashboardData(tenantContext || undefined);
          } else {
            setScanError(
              job.errorMessage ||
                `Product Hunter ended with status ${job.status}.`
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setScanError(
            error instanceof Error
              ? error.message
              : "Failed to poll job status."
          );
          setLoading(false);
        }
      }
    }

    void pollJob();

    const intervalId = window.setInterval(() => {
      void pollJob();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobId, refreshDashboardData, tenantContext]);

  const bestProduct = products[0];
  const bestDecision = bestProduct ? getAIDecision(bestProduct) : undefined;
  const lifecycleCounts = getLifecycleCounts(products);
  const cjDiscoveryStats = sources.find(
    (source) => source.name === "CJ Dropshipping"
  )?.metadata?.stats;
  const canRunScan =
    !loading && (discoveryMode !== "keyword" || keyword.trim().length >= 2);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight">AIVENTRA AI</h1>
        <p className="mt-3 text-slate-300">
          Autonomous Commerce. Human Vision.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card title="Products Scanned" value={String(totalProducts)} />
          <Card title="Winning Products" value={String(recommendedProducts)} />
          <Card
            title="Organisation"
            value={
              tenantContext?.organisationName ||
              tenantContext?.organisationId ||
              "Resolving"
            }
          />
          <Card
            title="Store"
            value={
              tenantContext?.storeName || tenantContext?.storeId || "Resolving"
            }
          />
          <Card title="Today's Revenue" value="Not connected" />
          <Card title="Estimated Profit" value="Estimated per product" />
          <Card title="Shopify Store" value="Connected" />
          <Card
            title="AI Decision"
            value={bestDecision?.decision || "No decision"}
          />
          <Card
            title="Top Stage"
            value={bestProduct ? getLifecycleLabel(bestProduct) : "None"}
          />
          <Card
            title="Evidence Health"
            value={formatProviderHealthSummary(providerHealth)}
          />
        </div>

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Product Lifecycle Pipeline</h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LIFECYCLE_STAGES.map((stage) => (
              <div key={stage} className="rounded-xl bg-slate-800 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {PRODUCT_LIFECYCLE_LABELS[stage]}
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {lifecycleCounts[stage] || 0}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">AI Memory</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MemoryList
              title="Most Seen"
              items={memoryDashboard.mostSeen}
              value={(memory) => `${memory.timesSeen} scans`}
            />
            <MemoryList
              title="Most Published"
              items={memoryDashboard.mostPublished}
              value={(memory) => `${memory.timesPublished} published`}
            />
            <MemoryList
              title="Highest Confidence"
              items={memoryDashboard.highestConfidence}
              value={(memory) => `${memory.currentConfidence}%`}
            />
            <MemoryList
              title="Fastest Growing"
              items={memoryDashboard.fastestGrowing}
              value={(memory) => formatTrendGrowth(memory)}
            />
          </div>
        </section>

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Product Discovery</h2>
              <p className="mt-1 text-sm text-slate-400">
                Current mode:{" "}
                {discoveryMode === "broad"
                  ? "Broad market"
                  : discoveryMode === "category"
                    ? "Category"
                    : "Keyword"}
              </p>
            </div>

            <div className="grid w-full gap-3 md:w-auto md:grid-cols-3">
              {([
                ["broad", "Broad market"],
                ["category", "Category"],
                ["keyword", "Keyword"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDiscoveryMode(mode)}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                    discoveryMode === mode
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {discoveryMode !== "broad" && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {discoveryMode === "category" && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-300">
                    Category
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3 text-white"
                  >
                    {DISCOVERY_CATEGORIES.filter(
                      (category) => category.enabled
                    ).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {discoveryMode === "keyword" && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-300">
                    Keyword
                  </span>
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="portable blender"
                    className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500"
                  />
                </label>
              )}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <button
            onClick={runAI}
            disabled={!canRunScan}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Scan Queued..." : "🚀 Run Product Hunter"}
          </button>

          <Button text="📈 Analyze Market" />

          <button
            onClick={() => {
              if (bestProduct) generatePublishing(bestProduct);
            }}
            disabled={!bestProduct || publishingLoading}
            className="rounded-xl bg-cyan-600 px-6 py-3 font-semibold hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishingLoading ? "Generating..." : "📝 Generate Listing"}
          </button>

          <button
            onClick={publishSelectedProduct}
            disabled={
              !selectedProduct ||
              !publishingPackage ||
              !publishingPackage.validationPassed ||
              publishLoading
            }
            className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishLoading ? "Publishing Draft..." : "🛒 Publish Product"}
          </button>
          <Button text="📣 Generate Marketing" />
          <Link
            href="/dashboard/ai"
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold hover:bg-blue-500"
          >
            AI Analytics
          </Link>
          <Link
            href="/settings/rules"
            className="rounded-xl bg-slate-800 px-6 py-3 text-center font-semibold hover:bg-slate-700"
          >
            Automation Rules
          </Link>
          <Link
            href="/orders"
            className="rounded-xl bg-slate-800 px-6 py-3 text-center font-semibold hover:bg-slate-700"
          >
            Orders
          </Link>
          <Link
            href="/operations/jobs"
            className="rounded-xl bg-slate-800 px-6 py-3 text-center font-semibold hover:bg-slate-700"
          >
            Operations Jobs
          </Link>
        </div>

        {scanError && (
          <section className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
            <p className="font-semibold text-red-300">
              Product Hunter failed
            </p>
            <p className="mt-2 text-slate-200">{scanError}</p>
          </section>
        )}

        {jobProgress && (
          <section className="mt-6 rounded-2xl bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Market Intelligence Scan
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {jobProgress.currentStep || "Queued"}
                </p>
              </div>

              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-sm font-semibold text-blue-300">
                {jobProgress.progress}%
              </span>
            </div>

            <div className="mt-5 h-2 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${jobProgress.progress}%` }}
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {PRODUCT_SCAN_STEPS.map((step) => {
                const state = getScanStepState(jobProgress, step);

                return (
                  <div key={step.label} className="rounded-xl bg-slate-800 p-4">
                    <p className="font-semibold">{step.label}</p>
                    <p
                      className={`mt-2 text-sm ${
                        state === "complete"
                          ? "text-emerald-300"
                          : state === "active"
                            ? "text-blue-300"
                            : "text-slate-400"
                      }`}
                    >
                      {state === "complete"
                        ? "Complete"
                        : state === "active"
                          ? `${jobProgress.progress}%`
                          : "Waiting"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Market Intelligence Sources</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {sources.map((source) => (
              <div key={source.name} className="rounded-xl bg-slate-800 p-4">
                <p className="font-semibold">{source.name}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {source.status === "success" ? "✅ Connected" : "❌ Failed"}
                </p>
                <p className="text-sm text-slate-400">
                  Products found: {source.count}
                </p>
              </div>
            ))}
          </div>

          {cjDiscoveryStats && (
            <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <CompactStat
                label="CJ queries"
                value={`${cjDiscoveryStats.queriesCompleted}/${cjDiscoveryStats.queriesPlanned}`}
              />
              <CompactStat
                label="Categories"
                value={String(cjDiscoveryStats.categoriesCovered)}
              />
              <CompactStat
                label="Raw products"
                value={String(cjDiscoveryStats.rawProducts)}
              />
              <CompactStat
                label="Unique products"
                value={String(cjDiscoveryStats.uniqueProducts)}
              />
              <CompactStat
                label="Passed filter"
                value={String(cjDiscoveryStats.passedFirstFilter)}
              />
              <CompactStat
                label="AI recommended"
                value={String(recommendedProducts)}
              />
            </div>
          )}

          <div className="mt-8 border-t border-slate-800 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Evidence Provider Health</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Verification sources used for automation readiness.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {providerHealth.length === 0 ? (
                <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400 md:col-span-3">
                  No evidence provider health has been recorded yet.
                </div>
              ) : (
                providerHealth.map((provider) => (
                  <div
                    key={`${provider.provider}-${provider.category}`}
                    className="rounded-xl bg-slate-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{provider.provider}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {provider.category.replace(/_/g, " ")}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getProviderHealthClass(
                          provider.status
                        )}`}
                      >
                        {formatProviderHealthStatus(provider.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <CompactStat
                        label="Latency"
                        value={`${provider.latencyMs}ms`}
                      />
                      <CompactStat label="Cost" value={`$${provider.cost}`} />
                      <CompactStat
                        label="Quota"
                        value={
                          provider.quotaRemaining == null
                            ? "Unknown"
                            : String(provider.quotaRemaining)
                        }
                      />
                      <CompactStat
                        label="Checked"
                        value={formatCheckedAt(provider.checkedAt)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">🏆 AI Recommended Products</h2>

          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            CJ product details are live. Several demand, review, competition and
            supplier metrics are currently estimated until additional real data
            providers are connected.
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {products.slice(0, 6).map((product) => {
              const productPublishStatus = productPublishStatuses[product.id];
              const decision = getAIDecision(product);
              const verification = getProductVerification(product);

              return (
                <div
                  key={product.id}
                  className="rounded-2xl bg-slate-900 p-5 shadow-lg"
                >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-48 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                    No image
                  </div>
                )}

                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold">{product.name}</h3>
                    <p className="text-sm text-slate-400">{product.category}</p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${getDecisionBadgeClass(
                        decision?.decision
                      )}`}
                    >
                      {decision?.decision || "REVIEW"}
                    </span>
                    <p className="mt-2 text-xs text-slate-400">
                      {decision
                        ? `${decision.confidence}% confidence`
                        : `${product.aiScore}/100 score`}
                    </p>
                  </div>
                </div>

                {verification?.status !== "verified" && (
                  <span className="mt-2 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                    {verification
                      ? `Evidence ${verification.status}`
                      : "Evidence missing"}
                  </span>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <MiniStat
                    label="Est. net profit"
                    value={
                      product.costAnalysis
                        ? `£${product.costAnalysis.netProfit.toFixed(2)}`
                        : "Unknown"
                    }
                  />
                  <MiniStat
                    label="Est. net margin"
                    value={
                      product.costAnalysis
                        ? `${product.costAnalysis.netMarginPercent.toFixed(1)}%`
                        : "Unknown"
                    }
                  />
                  <MiniStat
                    label="Shipping"
                    value={`${
                      product.intelligence?.shipping?.shippingScore ?? "-"
                    }%`}
                  />
                  <MiniStat
                    label="Supplier"
                    value={`${
                      product.intelligence?.supplier?.supplierScore ?? "-"
                    }%`}
                  />
                  <MiniStat
                    label="Demand"
                    value={`${
                      product.intelligence?.demand?.demandScore ?? "-"
                    }%`}
                  />
                  <MiniStat label="Stage" value={getLifecycleLabel(product)} />
                  <MiniStat
                    label="Confidence"
                    value={`${
                      product.intelligence?.confidence?.confidenceScore ?? "-"
                    }%`}
                  />
                  <MiniStat
                    label="Sources"
                    value={String(verification?.sourceCount ?? "-")}
                  />
                  <MiniStat
                    label="Evidence"
                    value={
                      verification
                        ? `${verification.verifiedCount}/${verification.evidenceCount}`
                        : "-"
                    }
                  />
                  <MiniStat
                    label="Data quality"
                    value={
                      verification
                        ? `${verification.dataQuality}/100`
                        : product.intelligence?.dataQuality?.status || "-"
                    }
                  />
                  <MiniStat
                    label="Seen"
                    value={String(product.memory?.timesSeen ?? "-")}
                  />
                  <MiniStat
                    label="Memory confidence"
                    value={
                      product.memory
                        ? `${product.memory.currentConfidence}%`
                        : "-"
                    }
                  />
                  <MiniStat
                    label="Supplier changes"
                    value={String(product.memory?.supplierChanges ?? "-")}
                  />
                </div>

                <p className="mt-4 text-sm text-slate-300">{product.reason}</p>

                {decision && (
                  <div className="mt-4 rounded-xl bg-slate-800 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          AI Decision
                        </p>
                        <p
                          className={`mt-1 text-lg font-bold ${getDecisionTextClass(
                            decision.decision
                          )}`}
                        >
                          {decision.decision}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-400">
                          Decision confidence
                        </p>
                        <p className="font-bold">{decision.confidence}%</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-slate-300">
                      {decision.reasons
                        .slice(0, 2)
                        .map((reason) => reason.message)
                        .join(" ")}
                    </p>

                    {decision.requiresHumanApproval && (
                      <span className="mt-3 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                        Human approval required
                      </span>
                    )}

                    {decision.automationAllowed && (
                      <span className="mt-3 inline-block rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Automation allowed
                      </span>
                    )}

                    {decision.readiness === "NOT_READY" && (
                      <div className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-100">
                        <p className="font-semibold">Not automation ready</p>
                        <p className="mt-1">
                          {(decision.readinessBlockingReasons || [])
                            .slice(0, 2)
                            .join(" ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {productPublishStatus && (
                  <div
                    className={`mt-4 rounded-xl border p-3 text-sm ${
                      productPublishStatus.success
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-300"
                    }`}
                  >
                    <p className="font-semibold">
                      {productPublishStatus.success
                        ? "✅ Shopify draft ready"
                        : "❌ Publishing failed"}
                    </p>

                    <p className="mt-1">{productPublishStatus.message}</p>

                    {productPublishStatus.externalUrl && (
                      <a
                        href={productPublishStatus.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block font-semibold text-cyan-400"
                      >
                        Open in Shopify →
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => generatePublishing(product)}
                    disabled={publishingLoading}
                    className="flex-1 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-50"
                  >
                    Generate Listing
                  </button>

                  {productPublishStatus?.success ? (
                    <a
                      href={productPublishStatus.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-xl bg-slate-700 px-4 py-2 text-center text-sm font-semibold hover:bg-slate-600"
                    >
                      Open Draft
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        if (
                          selectedProduct?.id === product.id &&
                          publishingPackage
                        ) {
                          publishSelectedProduct();
                        } else {
                          generatePublishing(product);
                        }
                      }}
                      disabled={publishingLoading || publishLoading}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {selectedProduct?.id === product.id && publishingPackage
                        ? "Publish Draft"
                      : "Prepare"}
                    </button>
                  )}
                </div>

                {product.databaseId ? (
                  <Link
                    href={`/products/${product.databaseId}`}
                    className="mt-3 block w-full rounded-xl bg-slate-800 px-4 py-2 text-center text-sm font-semibold hover:bg-slate-700"
                  >
                    Open Workspace
                  </Link>
                ) : (
                  <button
                    disabled
                    className="mt-3 w-full rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold opacity-50"
                  >
                    Workspace unavailable
                  </button>
                )}
              </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Recent AI Scans</h2>
              <p className="mt-1 text-sm text-slate-400">
                Product Hunter history saved in Supabase.
              </p>
            </div>

            {historyLoading && (
              <span className="text-sm text-slate-400">
                Loading history...
              </span>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {recentScans.length === 0 && !historyLoading ? (
              <div className="rounded-xl bg-slate-800 p-5 text-slate-400">
                No saved scans yet.
              </div>
            ) : (
              recentScans.map((scan) => (
                <div key={scan.id} className="rounded-xl bg-slate-800 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {new Date(scan.startedAt).toLocaleString("en-GB")}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {scan.totalFound} products scanned ·{" "}
                        {scan.totalRecommended} recommended
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        scan.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : scan.status === "failed"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {scan.status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {scan.providers.map((provider) => (
                      <span
                        key={`${scan.id}-${provider.name}`}
                        className={`rounded-full px-3 py-1 text-xs ${
                          provider.status === "success"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        {provider.name}{" "}
                        {provider.status === "success" ? "✓" : "✕"} (
                        {provider.count})
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {publishingPackage && (
          <section className="mt-10 rounded-2xl bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">AI Publishing Package</h2>

            {selectedProduct && (
              <div className="mt-4 flex items-center gap-4 rounded-xl bg-slate-800 p-4">
                {selectedProduct.imageUrl && (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                )}

                <div>
                  <p className="text-sm text-slate-400">Selected product</p>
                  <p className="font-bold">{selectedProduct.name}</p>
                  <p className="text-sm text-slate-300">
                    {selectedProduct.supplier}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Info label="Title" value={publishingPackage.title} />
              <Info label="SEO Title" value={publishingPackage.seoTitle} />
              <Info label="Handle" value={publishingPackage.handle} />
              <Info
                label="Price"
                value={`£${publishingPackage.sellPrice} / Compare at £${publishingPackage.compareAtPrice}`}
              />
              <Info label="Tags" value={publishingPackage.tags.join(", ")} />
              <Info
                label="Collections"
                value={publishingPackage.collections.join(", ")}
              />
              <Info
                label="Validation"
                value={
                  publishingPackage.validationPassed
                    ? "✅ Ready to publish"
                    : `❌ ${publishingPackage.validationErrors.join(", ")}`
                }
              />
            </div>
          </section>
        )}

        {publishResult && (
          <section
            className={`mt-6 rounded-2xl border p-5 ${
              publishResult.success
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-red-500/40 bg-red-500/10"
            }`}
          >
            <p
              className={
                publishResult.success
                  ? "font-semibold text-emerald-300"
                  : "font-semibold text-red-300"
              }
            >
              {publishResult.success
                ? "✅ Shopify draft created"
                : "❌ Publishing failed"}
            </p>

            <p className="mt-2 text-slate-200">{publishResult.message}</p>

            {publishResult.externalUrl && (
              <a
                href={publishResult.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Open draft in Shopify →
              </a>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-6">
      <p className="text-slate-400">{title}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function Button({ text }: { text: string }) {
  return (
    <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
      {text}
    </button>
  );
}

const LIFECYCLE_STAGES: ProductLifecycleStage[] = [
  "DISCOVERED",
  "ANALYSED",
  "AI_APPROVED",
  "LISTING_GENERATED",
  "DRAFT_CREATED",
  "PUBLISHED",
  "ADVERTISING",
  "SELLING",
  "SCALING",
  "RETIRED",
];

const PRODUCT_SCAN_STEPS = [
  { label: "Starting", progress: 5 },
  { label: "Collecting providers", progress: 15 },
  { label: "Normalising products", progress: 35 },
  { label: "Calculating intelligence", progress: 55 },
  { label: "Evaluating decisions", progress: 70 },
  { label: "Saving results", progress: 85 },
  { label: "Completed", progress: 100 },
];

function isTerminalJobStatus(status: BackgroundJob["status"]) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "dead_letter" ||
    status === "cancelled"
  );
}

function getScanStepState(
  job: BackgroundJob,
  step: (typeof PRODUCT_SCAN_STEPS)[number]
) {
  if (job.status === "completed" || job.progress >= step.progress) {
    return "complete";
  }

  if (job.currentStep === step.label) {
    return "active";
  }

  return "waiting";
}

function getLifecycleStage(product: Product): ProductLifecycleStage {
  return product.currentLifecycle || "DISCOVERED";
}

function getLifecycleLabel(product: Product) {
  return PRODUCT_LIFECYCLE_LABELS[getLifecycleStage(product)];
}

function getLifecycleCounts(products: Product[]) {
  return products.reduce(
    (counts, product) => {
      const stage = getLifecycleStage(product);

      counts[stage] += 1;

      return counts;
    },
    Object.fromEntries(
      LIFECYCLE_STAGES.map((stage) => [stage, 0])
    ) as Record<ProductLifecycleStage, number>
  );
}

function getAIDecision(product: Product) {
  return product.decision;
}

function getProductVerification(product: Product) {
  return product.verification || product.intelligence?.verification;
}

function formatProviderHealthSummary(providerHealth: ProviderHealth[]) {
  if (providerHealth.length === 0) return "No evidence";

  const healthy = providerHealth.filter(
    (provider) => provider.status === "healthy"
  ).length;

  return `${healthy}/${providerHealth.length} healthy`;
}

function formatProviderHealthStatus(status: ProviderHealth["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProviderHealthClass(status: ProviderHealth["status"]) {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/15 text-emerald-300";
    case "degraded":
      return "bg-amber-500/15 text-amber-300";
    case "quota_low":
      return "bg-orange-500/15 text-orange-300";
    case "failed":
      return "bg-red-500/15 text-red-300";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

function formatCheckedAt(value: string) {
  const checkedAt = new Date(value);

  if (Number.isNaN(checkedAt.getTime())) return "Unknown";

  return checkedAt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDecisionBadgeClass(decision?: string) {
  switch (decision) {
    case "PUBLISH":
      return "bg-emerald-500/20 text-emerald-300";
    case "BUY":
      return "bg-green-500/20 text-green-300";
    case "WATCH":
      return "bg-cyan-500/20 text-cyan-300";
    case "REVIEW":
      return "bg-amber-500/20 text-amber-300";
    case "IGNORE":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

function getDecisionTextClass(decision?: string) {
  switch (decision) {
    case "PUBLISH":
      return "text-emerald-300";
    case "BUY":
      return "text-cyan-300";
    case "WATCH":
      return "text-amber-300";
    case "REVIEW":
      return "text-orange-300";
    case "IGNORE":
      return "text-red-300";
    default:
      return "text-slate-300";
  }
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function MemoryList({
  title,
  items,
  value,
}: {
  title: string;
  items: NonNullable<Product["memory"]>[];
  value: (memory: NonNullable<Product["memory"]>) => string;
}) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="font-semibold">{title}</p>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No memory yet</p>
        ) : (
          items.slice(0, 3).map((memory) => (
            <div
              key={`${title}-${memory.productKey}`}
              className="rounded-lg bg-slate-900 p-3"
            >
              <p className="truncate text-sm font-semibold">
                {formatMemoryName(memory)}
              </p>
              <p className="mt-1 text-xs text-slate-400">{value(memory)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}

function formatMemoryName(memory: NonNullable<Product["memory"]>) {
  return memory.productKey
    .split(":")
    .at(-1)
    ?.split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || memory.productKey;
}

function formatTrendGrowth(memory: NonNullable<Product["memory"]>) {
  if (memory.trendHistory.length < 2) return "No trend";

  const growth =
    memory.trendHistory[memory.trendHistory.length - 1] -
    memory.trendHistory[0];

  if (growth === 0) return "Flat";

  return `${growth > 0 ? "+" : ""}${growth}% trend`;
}
