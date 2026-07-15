import Link from "next/link";
import { requirePageContext } from "@/auth/requirePageContext";
import { listOrders } from "@/services/repositories/orderRepository";
import {
  getOrderReadinessBadge,
  type OrderValidationStatus,
} from "@/orders/status";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const tenantContext = await requirePageContext("orders.read");
  const orders = await listOrders(tenantContext, 100);
  const today = new Date().toISOString().slice(0, 10);
  const todaysOrders = orders.filter((order) =>
    order.createdAt.startsWith(today)
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            Commerce
          </p>
          <h1 className="mt-2 text-3xl font-bold">Orders</h1>
          <p className="mt-2 text-slate-400">
            Shopify order intake, validation status and fulfilment readiness.
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Summary label="Today's Orders" value={String(todaysOrders.length)} />
          <Summary
            label="Pending"
            value={String(
              orders.filter((order) => order.validationStatus === "pending")
                .length
            )}
          />
          <Summary
            label="Awaiting Fulfilment"
            value={String(
              orders.filter((order) => order.status === "awaiting_fulfilment")
                .length
            )}
          />
          <Summary
            label="Fulfilled"
            value={String(
              orders.filter((order) => order.status === "fulfilled").length
            )}
          />
          <Summary
            label="Cancelled"
            value={String(
              orders.filter((order) => order.status === "cancelled").length
            )}
          />
          <Summary
            label="Refunded"
            value={String(
              orders.filter((order) => order.status === "refunded").length
            )}
          />
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Latest Orders</h2>

          <div className="mt-6 space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-xl bg-slate-800 p-5 text-slate-400">
                No Shopify orders have been received yet.
              </div>
            ) : (
              orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-xl bg-slate-800 p-5 hover:bg-slate-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {order.shopifyOrderName ||
                          `Order ${order.orderNumber || order.shopifyOrderId}`}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {new Date(order.createdAt).toLocaleString("en-GB")} ·{" "}
                        {order.currency} {order.total.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge status={order.validationStatus} />
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                        {order.status}
                      </span>
                    </div>
                  </div>
                </Link>
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
    <div className="rounded-xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Badge({ status }: { status: OrderValidationStatus }) {
  const label = getOrderReadinessBadge(status);
  const className =
    status === "ready"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "blocked"
        ? "bg-red-500/15 text-red-300"
        : status === "review"
          ? "bg-amber-500/15 text-amber-300"
          : "bg-slate-900 text-slate-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
