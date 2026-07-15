import "server-only";

import type { JobHandler } from "./types";
import { acquireCJPermit } from "@/services/providers/cj/cjRateLimiter";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { getCJShippingQuote } from "@/services/cjdropshipping/shipping";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";

async function saveShippingEvidence(input: {
  organisationId: string;
  storeId: string;
  jobId: string;
  productId: string;
  productDatabaseId?: string;
  quote: Awaited<ReturnType<typeof getCJShippingQuote>>;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin.from("evidence_records").insert({
    ...tenantColumns({
      organisationId: input.organisationId,
      storeId: input.storeId,
      timezone: "Europe/London",
      currency: input.quote.currency || "GBP",
      locale: "en-GB",
    }),
    product_id: input.productDatabaseId || null,
    product_key: `cj:${input.productId}`,
    provider: "cj",
    category: "shipping",
    verified: true,
    confidence: 90,
    quality: 90,
    retrieved_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    cost: 0,
    latency_ms: 0,
    data: {
      jobId: input.jobId,
      quoteId: input.quote.id,
      shippingCost: input.quote.shippingCost,
      deliveryDays: input.quote.deliveryDays,
      currency: input.quote.currency,
      carrier: input.quote.carrier,
      raw: input.quote.raw,
    },
  });

  if (error) {
    throw new Error(`Failed to save CJ shipping evidence: ${error.message}`);
  }
}

export const cjShippingQuoteHandler: JobHandler = {
  jobType: "CJ_SHIPPING_QUOTE",

  async handle({ message, reportProgress }) {
    await reportProgress(10, "Waiting for CJ permit");

    const permit = await acquireCJPermit();

    if (!permit.granted) {
      const delaySeconds = Math.max(1, Math.ceil(permit.retryAfterMs / 1000));

      await enqueueJobMessage({
        queueName: "aiventra-cj",
        jobId: message.jobId,
        jobType: message.jobType,
        organisationId: message.organisationId,
        storeId: message.storeId,
        payload: message.payload,
        correlationId: message.correlationId,
        causationId: message.causationId,
        attempt: message.attempt,
        delaySeconds,
      });

      return {
        rescheduled: true,
        resultReference: {
          rescheduled: true,
          retryAfterMs: permit.retryAfterMs,
          permittedAt: permit.permittedAt,
          delaySeconds,
        },
      };
    }

    await reportProgress(40, "Requesting live CJ shipping quote");

    const productId = String(message.payload.productId || "");

    if (!productId) {
      throw new Error("productId is required for CJ shipping quote jobs.");
    }

    const quote = await getCJShippingQuote({
      productId,
      destinationCountry: String(message.payload.destinationCountry || "GB"),
      quantity: Number(message.payload.quantity || 1),
    });

    await reportProgress(90, "Saving CJ shipping evidence");

    await saveShippingEvidence({
      organisationId: message.organisationId,
      storeId: message.storeId,
      jobId: message.jobId,
      productId,
      productDatabaseId:
        typeof message.payload.productDatabaseId === "string"
          ? message.payload.productDatabaseId
          : undefined,
      quote,
    });

    return {
      resultReference: {
        quoteId: quote.id,
        shippingCost: quote.shippingCost,
        deliveryDays: quote.deliveryDays,
        currency: quote.currency,
        carrier: quote.carrier,
      },
    };
  },
};
