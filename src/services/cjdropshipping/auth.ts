type CJTokenResponse = {
  code: number;
  result: boolean;
  message?: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiryDate: string;
    refreshTokenExpiryDate: string;
  };
};

let cachedToken: CJTokenResponse["data"] | null = null;

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

  if (!response.ok || data.code !== 200 || !data.data?.accessToken) {
    throw new Error(data.message || "Failed to get CJ access token");
  }

  cachedToken = data.data;

  return cachedToken.accessToken;
}
