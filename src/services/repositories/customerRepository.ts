import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import type { CommerceCustomer } from "@/orders/types";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";

type CustomerRow = {
  id: string;
  shopify_customer_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
};

function mapCustomer(row: CustomerRow): CommerceCustomer {
  return {
    id: row.id,
    shopifyCustomerId: row.shopify_customer_id || undefined,
    email: row.email || undefined,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    phone: row.phone || undefined,
    address: row.address || {},
  };
}

export async function upsertCustomer(input: {
  tenantContext: TenantContext;
  shopifyCustomerId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: Record<string, unknown>;
  rawData?: Record<string, unknown>;
}): Promise<CommerceCustomer | null> {
  if (!input.shopifyCustomerId && !input.email) return null;

  const row = {
    ...tenantColumns(input.tenantContext),
    shopify_customer_id: input.shopifyCustomerId || null,
    email: input.email?.toLowerCase() || null,
    first_name: input.firstName || null,
    last_name: input.lastName || null,
    phone: input.phone || null,
    address: input.address || {},
    raw_data: redactSensitiveData(input.rawData || {}),
    updated_at: new Date().toISOString(),
  };

  if (input.shopifyCustomerId) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .upsert(row, {
        onConflict: "organisation_id,store_id,shopify_customer_id",
      })
      .select("id, shopify_customer_id, email, first_name, last_name, phone, address")
      .single<CustomerRow>();

    if (error || !data) {
      throw new Error(
        `Failed to save customer: ${error?.message || "No row returned"}`
      );
    }

    return mapCustomer(data);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("email", input.email?.toLowerCase())
    .is("shopify_customer_id", null)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    throw new Error(`Failed to load guest customer: ${existingError.message}`);
  }

  const query = existing
    ? supabaseAdmin.from("customers").update(row).eq("id", existing.id)
    : supabaseAdmin.from("customers").insert(row);

  const { data, error } = await query
    .select("id, shopify_customer_id, email, first_name, last_name, phone, address")
    .single<CustomerRow>();

  if (error || !data) {
    throw new Error(
      `Failed to save guest customer: ${error?.message || "No row returned"}`
    );
  }

  return mapCustomer(data);
}

export async function getCustomerById(
  tenantContext: TenantContext,
  customerId: string
): Promise<CommerceCustomer | null> {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, shopify_customer_id, email, first_name, last_name, phone, address")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", customerId)
    .maybeSingle<CustomerRow>();

  if (error) {
    throw new Error(`Failed to load customer: ${error.message}`);
  }

  return data ? mapCustomer(data) : null;
}
