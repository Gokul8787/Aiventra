import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageContext } from "@/auth/requirePageContext";
import { getProductWorkspace } from "@/services/products/getProductWorkspace";
import { PRODUCT_LIFECYCLE_LABELS } from "@/lifecycle/ProductLifecycle";
import type { ExplanationItem } from "@/ai/explainability/types";
import { AIReplayButton } from "./AIReplayButton";

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductWorkspacePage({
  params,
}: ProductPageProps) {
  const { id } = await params;
  const tenantContext = await requirePageContext("products.read");
  const workspace = await getProductWorkspace(tenantContext, id);

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
    lifecycleHistory,
    relatedProducts,
    aiHistory,
    evidence,
    costAnalysis,
    supplierReliability,
    ruleEvaluations,
    explanation,
    memory,
    memoryEvents,
    tenantContext: workspaceTenantContext,
  } = workspace;

  const analysis = intelligence?.intelligence;
  const decision = product.decision;
  const currentLifecycle = product.currentLifecycle || "DISCOVERED";
  const verification = analysis?.verification || product.verification;

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
          <div className="mb-5 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              Organisation:{" "}
              {workspaceTenantContext.organisationName ||
                workspaceTenantContext.organisationId}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1">
              Store:{" "}
              {workspaceTenantContext.storeName || workspaceTenantContext.storeId}
            </span>
          </div>

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

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-cyan-500/10 px-5 py-4 text-center">
                    <p className="text-xs uppercase text-cyan-300">Stage</p>
                    <p className="mt-1 text-2xl font-bold text-cyan-300">
                      {PRODUCT_LIFECYCLE_LABELS[currentLifecycle]}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-blue-500/10 px-5 py-4 text-center">
                    <p className="text-xs uppercase text-blue-300">
                      AI Score
                    </p>
                    <p className="mt-1 text-3xl font-bold text-blue-300">
                      {intelligence?.overallScore ?? product.aiScore}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-emerald-500/10 px-5 py-4 text-center">
                    <p className="text-xs uppercase text-emerald-300">
                      AI Decision
                    </p>
                    <p className="mt-1 text-3xl font-bold text-emerald-300">
                      {decision?.decision || "REVIEW"}
                    </p>
                    <p className="mt-1 text-xs text-emerald-200">
                      {decision
                        ? `${decision.confidence}% confidence`
                        : "No decision saved"}
                    </p>
                  </div>
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
                  label="Organisation"
                  value={
                    workspaceTenantContext.organisationName ||
                    product.organisationId ||
                    workspaceTenantContext.organisationId
                  }
                />
                <Summary
                  label="Store"
                  value={
                    workspaceTenantContext.storeName ||
                    product.storeId ||
                    workspaceTenantContext.storeId
                  }
                />
                <Summary
                  label="Lifecycle stage"
                  value={PRODUCT_LIFECYCLE_LABELS[currentLifecycle]}
                />
                <Summary
                  label="Lifecycle status"
                  value={product.lifecycleStatus || "ACTIVE"}
                />
                <Summary
                  label="Decision confidence"
                  value={decision ? `${decision.confidence}%` : "Unknown"}
                />
                <Summary
                  label="Data quality"
                  value={
                    verification
                      ? `${verification.status} (${verification.dataQuality}/100)`
                      : analysis?.dataQuality?.status || "Unknown"
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">AI Memory</h2>

          {memory ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <Summary label="Seen" value={String(memory.timesSeen)} />
                <Summary
                  label="Recommended"
                  value={String(memory.timesRecommended)}
                />
                <Summary
                  label="Published"
                  value={String(memory.timesPublished)}
                />
                <Summary label="Sold" value={String(memory.timesSold)} />
                <Summary
                  label="Confidence"
                  value={`${memory.currentConfidence}%`}
                />
                <Summary
                  label="Trend"
                  value={formatMemoryTrend(memory.trendHistory)}
                />
                <Summary
                  label="AI score range"
                  value={`${memory.lowestAIScore} - ${memory.highestAIScore}`}
                />
                <Summary
                  label="Average score"
                  value={String(memory.averageAIScore)}
                />
                <Summary
                  label="Supplier changes"
                  value={String(memory.supplierChanges)}
                />
                <Summary
                  label="Current price"
                  value={`£${memory.currentPrice.toFixed(2)}`}
                />
                <Summary
                  label="Lowest price"
                  value={`£${memory.lowestPrice.toFixed(2)}`}
                />
                <Summary
                  label="Highest price"
                  value={`£${memory.highestPrice.toFixed(2)}`}
                />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl bg-slate-800 p-4">
                  <p className="font-semibold">Decision History</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {memory.decisionHistory.slice(-8).map((decision, index) => (
                      <span
                        key={`${decision}-${index}`}
                        className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300"
                      >
                        {decision}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 p-4">
                  <p className="font-semibold">Recent Memory Events</p>
                  <div className="mt-3 space-y-2">
                    {memoryEvents.slice(0, 6).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-300"
                      >
                        <p className="font-semibold">
                          {formatMemoryEvent(event.type)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(event.occurredAt).toLocaleString("en-GB")}
                        </p>
                      </div>
                    ))}

                    {memoryEvents.length === 0 && (
                      <p className="text-sm text-slate-500">
                        No memory events recorded yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Empty text="No product memory has been recorded yet." />
          )}
        </section>

        {decision && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">AI Decision</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <Summary label="Decision" value={decision.decision} />
              <Summary
                label="Confidence"
                value={`${decision.confidence}%`}
              />
              <Summary label="Risk" value={decision.risk} />
              <Summary
                label="Automation"
                value={
                  decision.automationAllowed
                    ? "Allowed"
                    : "Approval required"
                }
              />
              <Summary
                label="Human approval"
                value={decision.requiresHumanApproval ? "Required" : "Not required"}
              />
              <Summary
                label="Readiness"
                value={decision.readiness || "NOT_READY"}
              />
              <Summary
                label="Engine version"
                value={decision.engineVersion}
              />
              <Summary
                label="Evaluated"
                value={new Date(decision.evaluatedAt).toLocaleString("en-GB")}
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <DecisionList
                title="Reasons"
                items={decision.reasons.map((reason) => reason.message)}
              />
              <DecisionList title="Warnings" items={decision.warnings} />
              <DecisionList title="Blockers" items={decision.blockers} />
              <DecisionList
                title="Readiness blockers"
                items={decision.readinessBlockingReasons || []}
              />
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Why AI Chose This</h2>

          {explanation ? (
            <>
              <p className="mt-3 text-slate-300">{explanation.summary}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Summary
                  label="Final score"
                  value={`${explanation.finalScore}/100`}
                />
                <Summary
                  label="Confidence"
                  value={`${explanation.confidence}%`}
                />
                <Summary label="Decision" value={explanation.decision} />
                <Summary label="Version" value={explanation.version} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {explanation.items.map((item) => (
                  <div
                    key={`${item.engine}-${item.title}`}
                    className="rounded-xl bg-slate-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {item.engine} · weight {Math.round(item.weight * 100)}%
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          item.impact === "positive"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {formatExplanationImpact(item)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-300">{item.reason}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Score {item.score}/100
                    </p>
                    {item.dataQuality && (
                      <p className="mt-1 text-xs text-slate-500">
                        Evidence {item.dataQuality} ·{" "}
                        {item.evidenceCount ?? 0} records
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty text="No AI explanation has been saved yet." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Product Intelligence</h2>

          {analysis ? (
            <>
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
            </>
          ) : (
            <Empty text="No intelligence analysis has been saved." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Confidence Breakdown</h2>

          {analysis ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Score
                  label="Completeness"
                  value={analysis.confidence.completenessScore}
                />
                <Score
                  label="Freshness"
                  value={analysis.confidence.freshnessScore}
                />
                <Score
                  label="Reliability"
                  value={analysis.confidence.reliabilityScore}
                />
                <Score
                  label="Agreement"
                  value={analysis.confidence.agreementScore}
                />
                <Summary
                  label="Verified evidence"
                  value={`${analysis.confidence.verifiedEvidenceCount} / ${analysis.confidence.evidenceCount}`}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DecisionList
                  title="Missing"
                  items={analysis.confidence.missingMetrics}
                />
                <DecisionList
                  title="Conflicts"
                  items={analysis.confidence.conflictingMetrics}
                />
              </div>
            </>
          ) : (
            <Empty text="No confidence analysis has been saved." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Evidence Verification</h2>

          {verification ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <Summary label="Status" value={verification.status} />
                <Summary
                  label="Data quality"
                  value={`${verification.dataQuality}/100`}
                />
                <Summary
                  label="Evidence"
                  value={`${verification.verifiedCount}/${verification.evidenceCount}`}
                />
                <Summary
                  label="Sources"
                  value={String(verification.sourceCount)}
                />
                <Summary
                  label="Freshness"
                  value={`${verification.freshnessScore}/100`}
                />
                <Summary
                  label="Coverage"
                  value={`${verification.coverageScore}/100`}
                />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.values(verification.byCategory).map((category) => (
                  <div
                    key={category.category}
                    className="rounded-xl bg-slate-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {formatCategoryName(category.category)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {category.providers.join(", ") || "No provider"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          category.status === "verified"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : category.status === "mixed"
                              ? "bg-cyan-500/15 text-cyan-300"
                              : category.status === "estimated"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {category.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <InlineStat
                        label="Quality"
                        value={`${category.dataQuality}/100`}
                      />
                      <InlineStat
                        label="Records"
                        value={`${category.verifiedCount}/${category.evidenceCount}`}
                      />
                      <InlineStat
                        label="Sources"
                        value={String(category.sourceCount)}
                      />
                      <InlineStat
                        label="Freshness"
                        value={`${category.freshnessScore}/100`}
                      />
                    </div>

                    {category.blockingReasons.length > 0 && (
                      <p className="mt-3 text-xs text-amber-200">
                        {category.blockingReasons.slice(0, 2).join(" ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {verification.blockingReasons.length > 0 && (
                <div className="mt-6">
                  <DecisionList
                    title="Verification blockers"
                    items={verification.blockingReasons}
                  />
                </div>
              )}
            </>
          ) : (
            <Empty text="No evidence verification summary has been saved yet." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Evidence</h2>

          {evidence.length > 0 ? (
            <div className="mt-6 space-y-3">
              {evidence.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-800 p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {formatEvidenceSource(item.source)} ·{" "}
                      {formatEvidenceMetric(item.metric)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Value: {formatEvidenceValue(item.metric, item.value)} ·
                      Score: {item.normalizedScore}/100
                    </p>
                  </div>

                  <div className="text-right text-sm text-slate-400">
                    <p>{item.verified ? "verified" : "unverified"}</p>
                    <p>{formatEvidenceAge(item.observedAt)} old</p>
                    <p>
                      Reliability {item.reliability}/100 · Completeness{" "}
                      {item.completeness}/100
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No product evidence has been saved yet." />
          )}
        </section>

        {costAnalysis && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Estimated Cost & Profit
                </h2>

                <p className="mt-1 text-sm text-amber-300">
                  Pre-sale estimate. Advertising, shipping, returns and tax
                  values may change.
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  costAnalysis.financiallyViable
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {costAnalysis.financiallyViable
                  ? "Financially viable"
                  : "Not viable"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Summary
                label="Revenue"
                value={`£${costAnalysis.revenue.toFixed(2)}`}
              />

              <Summary
                label="Net profit"
                value={`£${costAnalysis.netProfit.toFixed(2)}`}
              />

              <Summary
                label="Net margin"
                value={`${costAnalysis.netMarginPercent.toFixed(2)}%`}
              />

              <Summary
                label="ROI"
                value={`${costAnalysis.roiPercent.toFixed(2)}%`}
              />

              <Summary
                label="Maximum CPA"
                value={`£${costAnalysis.maximumAffordableCPA.toFixed(2)}`}
              />

              <Summary
                label="Break-even ROAS"
                value={costAnalysis.breakEvenROAS.toFixed(2)}
              />

              <Summary
                label="Total costs"
                value={`£${costAnalysis.totalCost.toFixed(2)}`}
              />

              <Summary
                label="Profit score"
                value={`${costAnalysis.profitScore}/100`}
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                ["Supplier", costAnalysis.costs.supplierCost],
                ["Shipping", costAnalysis.costs.shippingCost],
                ["Payment fee", costAnalysis.costs.paymentFee],
                ["Shopify allocation", costAnalysis.costs.platformFeeAllocation],
                ["Advertising", costAnalysis.costs.advertisingCost],
                ["Returns reserve", costAnalysis.costs.returnAllowance],
                ["Currency fee", costAnalysis.costs.currencyConversionFee],
                ["VAT reserve", costAnalysis.costs.vatReserve],
                ["Other costs", costAnalysis.costs.otherCosts],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex justify-between rounded-xl bg-slate-800 p-4"
                >
                  <span className="text-slate-400">{String(label)}</span>

                  <span className="font-semibold">
                    £{Number(value).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {supplierReliability && (
          <section className="mt-8 rounded-2xl bg-slate-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Supplier Reliability</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Historical reliability from supplier snapshots and fulfilment
                  evidence.
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  supplierReliability.supplierRisk === "low"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : supplierReliability.supplierRisk === "medium"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
                }`}
              >
                {supplierReliability.supplierRisk} risk
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Score
                label="Supplier score"
                value={supplierReliability.supplierScore}
              />
              <Summary
                label="Preferred supplier"
                value={supplierReliability.preferredSupplier ? "Yes" : "No"}
              />
              <Summary
                label="Data quality"
                value={supplierReliability.dataQuality}
              />
              <Summary
                label="Sample size"
                value={String(supplierReliability.sampleSize)}
              />
              <Summary
                label="Last updated"
                value={new Date(
                  supplierReliability.lastUpdated
                ).toLocaleString("en-GB")}
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {Object.entries(supplierReliability.metrics).map(
                ([name, metric]) => (
                  <div key={name} className="rounded-xl bg-slate-800 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {formatSupplierMetricName(name)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {metric.reason}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold">{metric.score}/100</p>
                        <p
                          className={`text-xs ${
                            metric.status === "verified"
                              ? "text-emerald-300"
                              : metric.status === "estimated"
                                ? "text-amber-300"
                                : "text-slate-500"
                          }`}
                        >
                          {metric.status}
                        </p>
                        <p className="text-xs text-slate-500">
                          n={metric.sampleSize}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <DecisionList
                title="Reasons"
                items={supplierReliability.reasons}
              />
              <DecisionList
                title="Warnings"
                items={supplierReliability.warnings}
              />
              <DecisionList
                title="Missing evidence"
                items={supplierReliability.missingEvidence.map(
                  formatSupplierMetricName
                )}
              />
            </div>
          </section>
        )}

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
          <h2 className="text-2xl font-bold">Lifecycle Timeline</h2>

          {lifecycleHistory.length > 0 ? (
            <div className="mt-6 space-y-4">
              {lifecycleHistory.map((item) => (
                <div
                  key={`${item.to}-${item.timestamp}`}
                  className="rounded-xl bg-slate-800 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {item.from
                          ? `${PRODUCT_LIFECYCLE_LABELS[item.from]} -> ${
                              PRODUCT_LIFECYCLE_LABELS[item.to]
                            }`
                          : PRODUCT_LIFECYCLE_LABELS[item.to]}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.reason}
                      </p>
                    </div>

                    <div className="text-right text-sm text-slate-400">
                      <p>{new Date(item.timestamp).toLocaleString("en-GB")}</p>
                      <p>{item.actor}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No lifecycle transitions have been recorded yet." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Automation Rules</h2>

          {ruleEvaluations.length > 0 ? (
            <div className="mt-6 space-y-4">
              {ruleEvaluations.map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="rounded-xl bg-slate-800 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{evaluation.ruleName}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {new Date(evaluation.evaluatedAt).toLocaleString(
                          "en-GB"
                        )}{" "}
                        · {evaluation.executionMode}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        evaluation.matched
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {evaluation.matched ? "Matched" : "Not matched"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DecisionList
                      title="Condition Results"
                      items={evaluation.conditionResults.map(
                        (result) => result.reason
                      )}
                    />
                    <DecisionList
                      title={
                        evaluation.executionMode === "DRY_RUN"
                          ? "Would Run"
                          : "Actions"
                      }
                      items={evaluation.actions.map((action) => action.type)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No automation rules have evaluated this product yet." />
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">AI History</h2>

          {aiHistory.length > 0 ? (
            <div className="mt-6 space-y-4">
              {aiHistory.map((item) => (
                <div key={item.id} className="rounded-xl bg-slate-800 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {item.prompt?.feature || "AI Prompt"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        v{item.prompt?.promptVersion || "unknown"} ·{" "}
                        {item.model || item.prompt?.model || "unknown model"}
                      </p>
                    </div>

                    <div className="text-right text-sm text-slate-400">
                      <p>{new Date(item.createdAt).toLocaleString("en-GB")}</p>
                      <p>
                        {item.totalTokens.toLocaleString("en-GB")} tokens · $
                        {item.estimatedCost.toFixed(6)}
                      </p>
                      <p>{item.latencyMs}ms</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <PromptBlock
                      label="Prompt"
                      value={item.prompt?.userPrompt || "No prompt saved."}
                    />
                    <PromptBlock
                      label="Response"
                      value={item.response || "No response text saved."}
                    />
                  </div>

                  <AIReplayButton promptId={item.promptId} />
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No AI prompts have been recorded for this product yet." />
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

                <div className="text-right">
                  <span className="font-bold text-cyan-300">
                    {item.overallScore}/100
                  </span>
                </div>
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

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
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

function PromptBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-slate-300">
        {value}
      </p>
    </div>
  );
}

function formatEvidenceSource(source: string) {
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEvidenceMetric(metric: string) {
  return metric.charAt(0).toUpperCase() + metric.slice(1);
}

function formatCategoryName(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEvidenceValue(metric: string, value: number) {
  if (metric === "price") return `£${value.toFixed(2)}`;
  if (metric === "stock") return `${value} units`;
  if (metric === "shipping") return `${value} days`;

  return String(value);
}

function formatEvidenceAge(observedAt: string) {
  const ageMs = Date.now() - new Date(observedAt).getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / (60 * 1000)));

  if (ageMinutes < 60) return `${ageMinutes} minutes`;

  const ageHours = Math.round(ageMinutes / 60);

  if (ageHours < 48) return `${ageHours} hours`;

  return `${Math.round(ageHours / 24)} days`;
}

function formatSupplierMetricName(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMemoryTrend(history: number[]) {
  if (history.length < 2) return "No trend";

  const growth = history[history.length - 1] - history[0];

  if (growth === 0) return "Flat";

  return `${growth > 0 ? "+" : ""}${growth}%`;
}

function formatMemoryEvent(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatExplanationImpact(item: ExplanationItem) {
  const impact = item.score * item.weight;
  const prefix = item.impact === "positive" ? "+" : "-";

  return `${prefix}${impact.toFixed(1)}`;
}

function DecisionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="font-semibold">{title}</p>

      {items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">None</p>
      )}
    </div>
  );
}
