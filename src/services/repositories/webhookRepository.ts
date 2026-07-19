import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";

export type WebhookRecordResult = {
  id: string;
  duplicate: boolean;
  processed: boolean;
};

type StoreRow = {
  id: string;
  organisation_id: string;
  name: string | null;
  currency: string | null;
  currency_code: string | null;
  timezone: string | null;
  country: string | null;
};

export async function resolveShopifyTenantContext(
  shopDomain: string
): Promise<TenantContext> {
  const normalisedDomain = shopDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("id, organisation_id, name, currency, currency_code, timezone, country")
    .eq("platform", "shopify")
    .or(`shopify_domain.eq.${normalisedDomain},domain.eq.${normalisedDomain}`)
    .eq("active", true)
    .limit(1)
    .maybeSingle<StoreRow>();

  if (error) {
    throw new Error(`Failed to resolve Shopify store: ${error.message}`);
  }

  if (!store) {
    throw new Error(`No active Aiventra store found for ${normalisedDomain}.`);
  }

  return {
    organisationId: store.organisation_id,
    storeId: store.id,
    storeName: store.name || normalisedDomain,
    currency: store.currency_code || store.currency || "GBP",
    timezone: store.timezone || "Europe/London",
    locale: "en-GB",
    country: store.country || "GB",
  };
}

export async function recordWebhookEvent(input: {
  tenantContext?: TenantContext;
  provider: string;
  event: string;
  externalId: string;
  eventId?: string;
  shopDomain?: string;
  payload: Record<string, unknown>;
}): Promise<WebhookRecordResult> {
  const row = {
    organisation_id: input.tenantContext?.organisationId || null,
    store_id: input.tenantContext?.storeId || null,
    provider: input.provider,
    event: input.event,
    external_id: input.externalId,
    event_id: input.eventId || null,
    shop_domain: input.shopDomain || null,
    payload: redactSensitiveData(input.payload),
    processed: false,
  };

  const { data, error } = await supabaseAdmin
    .from("webhook_events")
    .insert(row)
    .select("id, processed")
    .single<{ id: string; processed: boolean }>();

  if (!error && data) {
    return {
      id: data.id,
      duplicate: false,
      processed: data.processed,
    };
  }

  if (error?.code !== "23505") {
    throw new Error(`Failed to record webhook event: ${error?.message}`);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("webhook_events")
    .select("id, processed")
    .eq("provider", input.provider)
    .eq("event", input.event)
    .eq("external_id", input.externalId)
    .single<{ id: string; processed: boolean }>();

  if (existingError || !existing) {
    throw new Error(
      `Failed to load duplicate webhook event: ${
        existingError?.message || "No row returned"
      }`
    );
  }

  return {
    id: existing.id,
    duplicate: true,
    processed: existing.processed,
  };
}

export async function markWebhookProcessed(input: {
  webhookEventId: string;
  processed: boolean;
  errorMessage?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("webhook_events")
    .update({
      processed: input.processed,
      processed_at: input.processed ? new Date().toISOString() : null,
      error_message: input.errorMessage || null,
    })
    .eq("id", input.webhookEventId);

  if (error) {
    throw new Error(`Failed to update webhook event: ${error.message}`);
  }
}
