import type {
  ProviderHealthRow,
  ProviderSnapshot,
} from "@/operations/types";

type ProviderId = "cj" | "shopify" | "openai" | "supabase";

const PROVIDER_DEFINITIONS: Record<
  ProviderId,
  {
    name: string;
    providers: string[];
    configured: () => boolean;
  }
> = {
  cj: {
    name: "CJ",
    providers: ["cj", "cjdropshipping"],
    configured: () => Boolean(process.env.CJ_API_KEY?.trim()),
  },
  shopify: {
    name: "Shopify",
    providers: ["shopify"],
    configured: () =>
      Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim()) &&
      Boolean(process.env.SHOPIFY_CLIENT_ID?.trim()) &&
      Boolean(process.env.SHOPIFY_CLIENT_SECRET?.trim()),
  },
  openai: {
    name: "OpenAI",
    providers: ["openai"],
    configured: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
  },
  supabase: {
    name: "Supabase",
    providers: ["supabase"],
    configured: () =>
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  },
};

function normaliseProviderId(provider: string) {
  return provider.trim().toLowerCase();
}

function statusRank(status: ProviderSnapshot["status"]) {
  switch (status) {
    case "critical":
      return 4;
    case "warning":
      return 3;
    case "unknown":
      return 2;
    case "missing":
      return 1;
    default:
      return 0;
  }
}

function mapProviderStatus(row: ProviderHealthRow): ProviderSnapshot["status"] {
  if (row.status === "failed") return "critical";
  if (row.status === "degraded" || row.status === "quota_low") return "warning";
  return "healthy";
}

export function buildProviderHealth(
  rows: ProviderHealthRow[]
): {
  summary: Record<ProviderSnapshot["status"], number>;
  providers: ProviderSnapshot[];
} {
  const providers = (Object.entries(PROVIDER_DEFINITIONS) as Array<
    [ProviderId, (typeof PROVIDER_DEFINITIONS)[ProviderId]]
  >).map(([id, definition]) => {
    const matchingRows = rows.filter((row) =>
      definition.providers.includes(normaliseProviderId(row.provider))
    );
    const configured = definition.configured();

    if (!configured) {
      return {
        id,
        name: definition.name,
        configured: false,
        status: "missing" as const,
        latencyMs: 0,
        failures: 0,
        availability: 0,
        categories: [],
        message: "Provider credentials are not configured.",
      };
    }

    if (matchingRows.length === 0) {
      return {
        id,
        name: definition.name,
        configured: true,
        status: "unknown" as const,
        latencyMs: 0,
        failures: 0,
        availability: 0,
        categories: [],
        message: "No recent provider health samples are available.",
      };
    }

    const status = matchingRows
      .map(mapProviderStatus)
      .sort((left, right) => statusRank(right) - statusRank(left))[0];
    const lastSuccess = matchingRows
      .map((row) => row.lastSuccessAt)
      .filter(Boolean)
      .sort()
      .pop();
    const lastFailure = matchingRows
      .map((row) => row.lastFailureAt)
      .filter(Boolean)
      .sort()
      .pop();
    const lastChecked = matchingRows
      .map((row) => row.checkedAt)
      .sort()
      .pop();
    const latencyValues = matchingRows.map((row) => row.latencyMs).filter(Boolean);
    const quotaValues = matchingRows
      .map((row) => row.quotaRemaining)
      .filter((value): value is number => typeof value === "number");
    const rateLimitValues = matchingRows
      .map((row) => row.rateLimitRemaining)
      .filter((value): value is number => typeof value === "number");
    const apiPointValues = matchingRows
      .map((row) => row.apiPointsRemaining)
      .filter((value): value is number => typeof value === "number");
    const availabilityValues = matchingRows
      .map((row) => row.availability)
      .filter((value): value is number => typeof value === "number");
    const errorRateValues = matchingRows
      .map((row) => row.errorRate)
      .filter((value): value is number => typeof value === "number");

    return {
      id,
      name: definition.name,
      configured: true,
      status,
      latencyMs:
        latencyValues.length > 0
          ? Math.round(
              latencyValues.reduce((sum, value) => sum + value, 0) /
                latencyValues.length
            )
          : 0,
      failures: errorRateValues.length
        ? Math.round(
            errorRateValues.reduce((sum, value) => sum + value, 0) /
              errorRateValues.length
          )
        : matchingRows.filter((row) => row.status === "failed").length,
      availability: availabilityValues.length
        ? Math.round(
            availabilityValues.reduce((sum, value) => sum + value, 0) /
              availabilityValues.length
          )
        : status === "healthy"
        ? 100
        : status === "warning"
        ? 75
        : 0,
      quotaRemaining: quotaValues.sort((left, right) => left - right)[0],
      rateLimitRemaining:
        rateLimitValues.sort((left, right) => left - right)[0],
      apiPointsRemaining: apiPointValues.sort((left, right) => left - right)[0],
      lastSuccessAt: lastSuccess,
      lastFailureAt: lastFailure,
      lastCheckedAt: lastChecked,
      message:
        matchingRows
          .map((row) => row.statusMessage)
          .filter(Boolean)
          .pop() || undefined,
      categories: Array.from(new Set(matchingRows.map((row) => row.category))),
      metadata: matchingRows[0]?.metadata,
    };
  });

  const summary = {
    healthy: 0,
    warning: 0,
    critical: 0,
    missing: 0,
    unknown: 0,
  } satisfies Record<ProviderSnapshot["status"], number>;

  for (const provider of providers) {
    summary[provider.status] += 1;
  }

  return {
    summary,
    providers,
  };
}
