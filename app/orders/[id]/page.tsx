import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageContext } from "@/auth/requirePageContext";
import { getCustomerById } from "@/services/repositories/customerRepository";
import {
  getOrderById,
  getOrderEvents,
  getOrderItems,
  getOrderValidations,
} from "@/services/repositories/orderRepository";
import { getFulfilmentChecksForOrder } from "@/services/repositories/supplierFulfilmentRepository";
import {
  getOrderReadinessBadge,
  type OrderValidationStatus,
} from "@/orders/status";

type OrderPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OrderWorkspacePage({ params }: OrderPageProps) {
  const { id } = await params;
  const tenantContext = await requirePageContext("orders.read");
  const order = await getOrderById(tenantContext, id);

  if (!order) {
    notFound();
  }

  const [items, validations, events, customer, fulfilmentChecks] = await Promise.all([
    getOrderItems(tenantContext, order.id),
    getOrderValidations(tenantContext, order.id),
    getOrderEvents(tenantContext, order.id),
    order.customerId
      ? getCustomerById(tenantContext, order.customerId)
      : Promise.resolve(null),
    getFulfilmentChecksForOrder(tenantContext, order.id),
  ]);
  const latestValidation = validations[0];
  const fulfilmentByItemId = new Map(
    fulfilmentChecks.map((check) => [check.orderItemId, check])
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/orders"
          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          ← Back to orders
        </Link>

        <section className="mt-6 rounded-2xl bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
                Order Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                {order.shopifyOrderName ||
                  `Order ${order.orderNumber || order.shopifyOrderId}`}
              </h1>
              <p className="mt-2 text-slate-400">
                Shopify ID {order.shopifyOrderId}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatusBadge status={order.validationStatus} />
              <span className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300">
                {order.status}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Summary label="Total" value={`${order.currency} ${order.total.toFixed(2)}`} />
            <Summary label="Subtotal" value={order.subtotal.toFixed(2)} />
            <Summary label="Shipping" value={order.shipping.toFixed(2)} />
            <Summary label="Tax" value={order.tax.toFixed(2)} />
            <Summary label="Discount" value={order.discount.toFixed(2)} />
            <Summary
              label="Financial"
              value={order.financialStatus || "Unknown"}
            />
            <Summary
              label="Fulfilment"
              value={order.fulfilmentStatus || "Unfulfilled"}
            />
            <Summary
              label="Placed"
              value={
                order.placedAt
                  ? new Date(order.placedAt).toLocaleString("en-GB")
                  : "Unknown"
              }
            />
            <Summary
              label="Validation"
              value={getOrderReadinessBadge(order.validationStatus)}
            />
            <Summary
              label="AI Decision"
              value={latestValidation?.decision || "Pending"}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">Products</h2>

            <div className="mt-6 space-y-3">
              {items.map((item) => {
                const fulfilmentCheck = fulfilmentByItemId.get(item.id);

                return (
                  <div key={item.id} className="rounded-xl bg-slate-800 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          SKU {item.sku || "Unknown"} · Qty {item.quantity}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Shopify variant {item.shopifyVariantId || "Unknown"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold">
                          {order.currency} {(item.price * item.quantity).toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.productId ? "Mapped" : "Unmapped"}
                        </p>
                      </div>
                    </div>

                    {fulfilmentCheck ? (
                      <div className="mt-5 border-t border-slate-700 pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-semibold">Supplier Fulfilment</h3>
                          <DecisionBadge decision={fulfilmentCheck.decision} />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <MiniSummary
                            label="Supplier"
                            value={fulfilmentCheck.supplierName || "Unknown"}
                          />
                          <MiniSummary
                            label="Mapping"
                            value={
                              fulfilmentCheck.supplierMappingId
                                ? "Verified"
                                : "Missing"
                            }
                          />
                          <MiniSummary
                            label="Inventory"
                            value={
                              fulfilmentCheck.availableQuantity === undefined
                                ? "Unknown"
                                : `${fulfilmentCheck.availableQuantity} available`
                            }
                          />
                          <MiniSummary
                            label="Current cost"
                            value={formatMoney(
                              order.currency,
                              fulfilmentCheck.latestUnitCost
                            )}
                          />
                          <MiniSummary
                            label="Cost change"
                            value={formatPercent(
                              fulfilmentCheck.costChangePercent
                            )}
                          />
                          <MiniSummary
                            label="Shipping"
                            value={formatMoney(
                              order.currency,
                              fulfilmentCheck.shippingCost
                            )}
                          />
                          <MiniSummary
                            label="Delivery"
                            value={formatDelivery(fulfilmentCheck)}
                          />
                          <MiniSummary
                            label="Estimated profit"
                            value={formatMoney(
                              order.currency,
                              fulfilmentCheck.estimatedNetProfit
                            )}
                          />
                          <MiniSummary
                            label="Margin"
                            value={formatPercent(
                              fulfilmentCheck.estimatedNetMarginPercent
                            )}
                          />
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <List
                            title="Warnings"
                            items={fulfilmentCheck.warnings}
                          />
                          <List
                            title="Blockers"
                            items={fulfilmentCheck.blockers}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-slate-700 pt-4 text-sm text-slate-400">
                        Supplier fulfilment has not been checked yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl bg-slate-900 p-6">
              <h2 className="text-2xl font-bold">Customer</h2>

              {customer ? (
                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  <p>
                    {customer.firstName || ""} {customer.lastName || ""}
                  </p>
                  <p>{customer.email || "No email"}</p>
                  <p>{customer.phone || "No phone"}</p>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  No customer record saved.
                </p>
              )}
            </section>

            <section className="rounded-2xl bg-slate-900 p-6">
              <h2 className="text-2xl font-bold">Validation</h2>

              {latestValidation ? (
                <div className="mt-5">
                  <Summary
                    label="Confidence"
                    value={`${latestValidation.confidence}%`}
                  />

                  <div className="mt-4 grid gap-4">
                    <List title="Reasons" items={latestValidation.reasons} />
                    <List title="Blockers" items={latestValidation.blockers} />
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  Validation has not run yet.
                </p>
              )}
            </section>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Timeline</h2>

          <div className="mt-6 space-y-4">
            {events.length === 0 ? (
              <div className="rounded-xl bg-slate-800 p-5 text-slate-400">
                No order events have been recorded yet.
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-xl bg-slate-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="font-semibold">{event.eventType}</p>
                    <p className="text-sm text-slate-400">
                      {new Date(event.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
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

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderValidationStatus }) {
  const className =
    status === "ready"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "blocked"
        ? "bg-red-500/15 text-red-300"
        : status === "review"
          ? "bg-amber-500/15 text-amber-300"
          : "bg-slate-800 text-slate-300";

  return (
    <span className={`rounded-full px-4 py-2 text-sm font-semibold ${className}`}>
      {getOrderReadinessBadge(status)}
    </span>
  );
}

function DecisionBadge({
  decision,
}: {
  decision: "AUTO_FULFIL" | "MANUAL_REVIEW" | "BLOCKED";
}) {
  const className =
    decision === "AUTO_FULFIL"
      ? "bg-emerald-500/15 text-emerald-300"
      : decision === "BLOCKED"
        ? "bg-red-500/15 text-red-300"
        : "bg-amber-500/15 text-amber-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {decision}
    </span>
  );
}

function formatMoney(currency: string, value?: number) {
  if (value === undefined) return "-";

  return `${currency} ${value.toFixed(2)}`;
}

function formatPercent(value?: number) {
  if (value === undefined) return "-";

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDelivery(check: {
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
}) {
  if (check.deliveryDaysMin === undefined && check.deliveryDaysMax === undefined) {
    return "-";
  }

  if (
    check.deliveryDaysMin !== undefined &&
    check.deliveryDaysMax !== undefined &&
    check.deliveryDaysMin !== check.deliveryDaysMax
  ) {
    return `${check.deliveryDaysMin}-${check.deliveryDaysMax} days`;
  }

  return `${check.deliveryDaysMax ?? check.deliveryDaysMin} days`;
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None</p>
      )}
    </div>
  );
}
