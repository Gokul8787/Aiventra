import "server-only";

import { getCJAccessToken } from "./auth";

export async function testCJConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await getCJAccessToken();

    return {
      success: true,
      message: "CJ Dropshipping authentication succeeded.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "CJ Dropshipping authentication failed.",
    };
  }
}
