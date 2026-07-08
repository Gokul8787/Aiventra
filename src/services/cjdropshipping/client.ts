import { getCJAccessToken } from "./auth";

const BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

export async function cjFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getCJAccessToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "CJ-Access-Token": token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`CJ API Error: ${response.status}`);
  }

  return response.json();
}
