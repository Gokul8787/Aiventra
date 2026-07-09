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
  validationPassed: boolean;
  validationErrors: string[];
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishingLoading, setPublishingLoading] = useState(false);
  const [publishingPackage, setPublishingPackage] =
    useState<PublishingPackage | null>(null);

  async function runAI() {
    setLoading(true);

    const response = await fetch("/api/ai/product-hunter");
    const data = await response.json();

    setProducts(data.products || []);
    setSources(data.sources || []);
    setLoading(false);
  }

  async function generatePublishing() {
    setPublishingLoading(true);

    const response = await fetch("/api/ai/publishing");
    const data = await response.json();

    setPublishingPackage(data.publishingPackage || null);
    setPublishingLoading(false);
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
            onClick={generatePublishing}
            className="rounded-xl bg-cyan-600 px-6 py-3 font-semibold hover:bg-cyan-500"
          >
            {publishingLoading ? "Generating..." : "📝 Generate Listing"}
          </button>

          <Button text="🛒 Publish Product" />
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
            {products.slice(0, 6).map((product) => (
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

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={generatePublishing}
                    className="flex-1 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold hover:bg-cyan-500"
                  >
                    Generate Listing
                  </button>

                  <button className="flex-1 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700">
                    Publish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {publishingPackage && (
          <section className="mt-10 rounded-2xl bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">AI Publishing Package</h2>

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
