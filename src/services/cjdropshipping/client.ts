import { getCJAccessToken } from "./auth";

const BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

export type CJFetchMetadata = {
  status: number;
  requestId?: string;
  pointsInfo?: Record<string, unknown>;
};

export class CJFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown,
    readonly metadata: CJFetchMetadata
  ) {
    super(message);
    this.name = "CJFetchError";
  }
}

function getHeaderValue(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);

    if (value) return value;
  }

  return undefined;
}

function readPointsInfo(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return undefined;

  const record = data as Record<string, unknown>;
  const pointsInfo = record.pointsInfo || record.points_info;

  return pointsInfo && typeof pointsInfo === "object"
    ? (pointsInfo as Record<string, unknown>)
    : undefined;
}

export async function cjFetch<T = Record<string, unknown>>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const result = await cjFetchWithMeta<T>(endpoint, options);

  return result.data;
}

export async function cjFetchWithMeta<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; metadata: CJFetchMetadata }> {
  const token = await getCJAccessToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "CJ-Access-Token": token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  const metadata = {
      status: response.status,
      requestId:
        getHeaderValue(response.headers, [
          "x-request-id",
          "request-id",
          "requestid",
          "cj-request-id",
        ]) ||
        (data && typeof data === "object"
          ? String(
              (data as Record<string, unknown>).requestId ||
                (data as Record<string, unknown>).request_id ||
                ""
            ) || undefined
          : undefined),
      pointsInfo: readPointsInfo(data),
    };

  if (!response.ok) {
    throw new CJFetchError(
      `CJ API Error: ${response.status}`,
      response.status,
      data,
      metadata
    );
  }

  return {
    data,
    metadata,
  };
}
