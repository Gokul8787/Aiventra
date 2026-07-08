"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/ai/types/product";

type SourceStatus = {
  name: string;
  status: "success" | "failed";
  count: number;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(false);

  async function runAI() {
    setLoading(true);

    const response = await fetch("/api/ai/product-hunter");
    const data = await response.json();

    setProducts(data.products || []);
    setSources(data.sources || []);
    setLoading(false);
  }

  useEffect(() => {
    void runAI();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <section className="mx-auto max-w-6xl">
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
            value={products[0] ? `${products[0].aiScore}%` : "0%"}
          />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <button
            onClick={runAI}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            {loading ? "Running AI..." : "Run Product Hunter"}
          </button>
          <Button text="Analyze Trends" />
          <Button text="Import Products" />
          <Button text="Generate Marketing" />
          <Button text="Launch Store" />
          <Button text="Settings" />
        </div>

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Market Intelligence Sources</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
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

        <section className="mt-10 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">AI Product Recommendations</h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-3">Product</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3">Sell Price</th>
                  <th className="pb-3">Margin</th>
                  <th className="pb-3">AI Score</th>
                  <th className="pb-3">Reason</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-slate-800">
                    <td className="py-4 font-semibold">{product.name}</td>
                    <td>{product.category}</td>
                    <td>£{product.supplierPrice}</td>
                    <td>£{product.sellPrice}</td>
                    <td>{product.profitMargin}%</td>
                    <td className="font-bold text-blue-400">
                      {product.aiScore}/100
                    </td>
                    <td className="max-w-xs text-slate-300">
                      {product.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
