import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductWorkspace } from "@/services/products/getProductWorkspace";

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductWorkspacePage({
  params,
}: ProductPageProps) {
  const { id } = await params;
  const workspace = await getProductWorkspace(id);

  if (!workspace) {
    notFound();
  }

  const {
    product,
    intelligence,
    intelligenceHistory,
    publishingPackage,
    publication,
    history,
    relatedProducts,
  } = workspace;

  const analysis = intelligence?.intelligence;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          ← Back to dashboard
        </Link>

        <section className="mt-6 rounded-2xl bg-slate-900 p-6">
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-60 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-60 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
                No image
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
                    Product Workspace
                  </p>

                  <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>

                  <p className="mt-2 text-slate-400">
                    {product.category} · {product.supplier}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-500/10 px-5 py-4 text-center">
                  <p className="text-xs uppercase text-emerald-300">
                    AI Score
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-300">
                    {intelligence?.overallScore ?? product.aiScore}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Summary
                  label="Supplier price"
                  value={`£${product.supplierPrice.toFixed(2)}`}
                />
                <Summary
                  label="Suggested price"
                  value={`£${product.sellPrice.toFixed(2)}`}
                />
                <Summary
                  label="Shipping"
                  value={`${product.shippingDays} days`}
                />
                <Summary
                  label="Stock"
                  value={product.stock == null ? "Unknown" : String(product.stock)}
                />
                <Summary
                  label="Provider"
                  value={product.provider || product.supplier}
                />
                <Summary
                  label="Data quality"
                  value={analysis?.dataQuality?.status || "Unknown"}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Product Intelligence</h2>

          {analysis ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Score label="Demand" value={analysis.demand.demandScore} />
              <Score
                label="Competition opportunity"
                value={analysis.competition.competitionOpportunityScore}
              />
              <Score label="Profit" value={analysis.profit.profitScore} />
              <Score
                label="Shipping"
                value={analysis.shipping.shippingScore}
              />
              <Score
                label="Supplier"
                value={analysis.supplier.supplierScore}
              />
              <Score label="Reviews" value={analysis.reviews.reviewScore} />
              <Score
                label="Seasonality"
                value={analysis.seasonality.seasonalityScore}
              />
              <Score
                label="Confidence"
                value={analysis.confidence.confidenceScore}
              />
            </div>
          ) : (
            <Empty text="No intelligence analysis has been saved." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Publishing Package</h2>

          {publishingPackage ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Info label="Title" value={publishingPackage.title} />
              <Info
                label="SEO title"
                value={publishingPackage.seoTitle || "Not set"}
              />
              <Info
                label="SEO description"
                value={publishingPackage.seoDescription || "Not set"}
              />
              <Info label="Handle" value={publishingPackage.handle} />
              <Info
                label="Price"
                value={`£${publishingPackage.sellPrice.toFixed(2)}`}
              />
              <Info
                label="Compare-at price"
                value={
                  publishingPackage.compareAtPrice == null
                    ? "Not set"
                    : `£${publishingPackage.compareAtPrice.toFixed(2)}`
                }
              />
              <Info
                label="Tags"
                value={publishingPackage.tags.join(", ") || "None"}
              />
              <Info
                label="Collections"
                value={publishingPackage.collections.join(", ") || "None"}
              />
              <Info
                label="Validation"
                value={
                  publishingPackage.validationPassed
                    ? "Ready to publish"
                    : publishingPackage.validationErrors.join(", ")
                }
              />

              <div className="rounded-xl bg-slate-800 p-4 md:col-span-2">
                <p className="text-sm text-slate-400">Description</p>
                <div
                  className="prose prose-invert mt-3 max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: publishingPackage.descriptionHtml,
                  }}
                />
              </div>
            </div>
          ) : (
            <Empty text="No publishing package has been saved for this product yet." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Shopify Publication</h2>

          {publication ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Info label="Status" value={publication.status} />
              <Info label="Platform" value={publication.platform} />
              <Info
                label="External product ID"
                value={publication.externalProductId || "Unknown"}
              />
              <Info
                label="Published"
                value={
                  publication.publishedAt
                    ? new Date(publication.publishedAt).toLocaleString("en-GB")
                    : "Not recorded"
                }
              />

              {publication.externalUrl && (
                <a
                  href={publication.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-center font-semibold hover:bg-cyan-500 md:col-span-2"
                >
                  Open in Shopify
                </a>
              )}
            </div>
          ) : (
            <Empty text="No Shopify publication has been saved for this product yet." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Product History</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Summary
              label="First seen"
              value={new Date(history.firstSeenAt).toLocaleDateString("en-GB")}
            />
            <Summary
              label="Last seen"
              value={new Date(history.lastSeenAt).toLocaleDateString("en-GB")}
            />
            <Summary
              label="Times scanned"
              value={String(history.timesScanned)}
            />
            <Summary
              label="Times recommended"
              value={String(history.timesRecommended)}
            />
            <Summary
              label="Latest score"
              value={
                history.latestAIScore == null
                  ? "Unknown"
                  : String(history.latestAIScore)
              }
            />
          </div>

          <div className="mt-6 space-y-3">
            {intelligenceHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-slate-800 p-4"
              >
                <span className="text-sm text-slate-300">
                  {new Date(item.calculatedAt).toLocaleString("en-GB")}
                </span>

                <span className="font-bold text-cyan-300">
                  {item.overallScore}/100
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Related Products</h2>

          {relatedProducts.length > 0 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {relatedProducts.map((related) => (
                <Link
                  key={related.databaseId}
                  href={`/products/${related.databaseId}`}
                  className="rounded-xl bg-slate-800 p-4 hover:bg-slate-700"
                >
                  {related.imageUrl ? (
                    <img
                      src={related.imageUrl}
                      alt={related.name}
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-slate-700 text-sm text-slate-400">
                      No image
                    </div>
                  )}

                  <p className="mt-3 font-semibold">{related.name}</p>

                  <p className="mt-1 text-sm text-slate-400">
                    Score: {related.aiScore ?? "Unknown"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="No related products found." />
          )}
        </section>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}/100</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 break-words font-semibold">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-xl bg-slate-800 p-5 text-slate-400">
      {text}
    </div>
  );
}
