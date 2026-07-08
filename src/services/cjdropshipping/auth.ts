type CJTokenResponse = {
  code: number;
  result?: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiryDate: string;
    refreshTokenExpiryDate: string;
  };
  message?: string;
};

let cachedToken: CJTokenResponse["result"] | null = null;

export async function getCJAccessToken(): Promise<string> {
  if (cachedToken && new Date(cachedToken.accessTokenExpiryDate) > new Date()) {
    return cachedToken.accessToken;
  }

  const response = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: process.env.CJ_API_KEY,
      }),
    }
  );

  const data: CJTokenResponse = await response.json();

  if (!response.ok || data.code !== 200 || !data.result?.accessToken) {
    throw new Error(data.message || "Failed to get CJ access token");
  }

  cachedToken = data.result;

  return cachedToken.accessToken;
}
