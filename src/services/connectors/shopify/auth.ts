type ShopifyTokenResponse = {
  access_token: string;
  scope: string;
  expires_in: number;
};

type CachedShopifyToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedShopifyToken | null = null;

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function getShopifyAccessToken(): Promise<string> {
  const now = Date.now();

  // Refresh five minutes before actual expiry.
  if (cachedToken && cachedToken.expiresAt - 5 * 60 * 1000 > now) {
    return cachedToken.accessToken;
  }

  const shop = getRequiredEnvironmentVariable("SHOPIFY_STORE_DOMAIN");
  const clientId = getRequiredEnvironmentVariable("SHOPIFY_CLIENT_ID");
  const clientSecret = getRequiredEnvironmentVariable("SHOPIFY_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Shopify authentication failed (${response.status}): ${responseText}`
    );
  }

  let data: ShopifyTokenResponse;

  try {
    data = JSON.parse(responseText) as ShopifyTokenResponse;
  } catch {
    throw new Error("Shopify returned an invalid authentication response.");
  }

  if (!data.access_token || !data.expires_in) {
    throw new Error("Shopify authentication response did not contain a token.");
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}
