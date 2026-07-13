"use client";

import { useEffect, useState } from "react";
import { Product } from "@/ai/types/product";

type SourceStatus = {
  name: string;
  status: "success" | "failed";
  count: number;
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

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
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

  async function runAI() {
    setLoading(true);

    const response = await fetch("/api/ai/product-hunter");
    const data = await response.json();

    setProducts(data.products || []);
    setSources(data.sources || []);
    setLoading(false);
  }

  async function generatePublishing(product: Product) {
    try {
      setPublishingLoading(true);
      setPublishingPackage(null);
      setPublishResult(null);
      setSelectedProduct(product);

      const response = await fetch("/api/ai/publishing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Publishing package generation failed.");
      }

      setPublishingPackage(data.publishingPackage);
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
        headers: {
          "Content-Type": "application/json",
        },
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
    runAI();
  }, []);

  const bestProduct = products[0];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold tracking-tight">AIVENTRA AI</h1>
        <p className="mt-3 text-slate-300">
          Autonomous Commerce. Human Vision.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card title="Products Scanned" value={String(products.length)} />
          <Card title="Winning Products" value={String(products.length)} />
          <Card title="Today's Revenue" value="£0" />
          <Card title="Estimated Profit" value="£65+" />
          <Card title="Active Stores" value="1" />
          <Card
            title="AI Confidence"
            value={bestProduct ? `${bestProduct.aiScore}%` : "0%"}
          />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <button
            onClick={runAI}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            {loading ? "Running AI..." : "🚀 Run Product Hunter"}
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
          <Button text="⚙ Settings" />
        </div>

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
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">🏆 AI Recommended Products</h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {products.slice(0, 6).map((product) => {
              const productPublishStatus = productPublishStatuses[product.id];

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

                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-bold text-green-400">
                    {product.aiScore}/100
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <MiniStat
                    label="Profit"
                    value={`${
                      product.intelligence?.profit?.profitScore ?? "-"
                    }%`}
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
                </div>

                <p className="mt-4 text-sm text-slate-300">{product.reason}</p>

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
              </div>
              );
            })}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-bold">{value}</p>
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
