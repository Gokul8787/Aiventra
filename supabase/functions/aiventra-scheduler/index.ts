export {};

declare const Deno: {
  serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
  env: {
    get(name: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  const appUrl = Deno.env.get("AIVENTRA_APP_URL");
  const workerSecret = Deno.env.get("AIVENTRA_WORKER_SECRET");

  if (!appUrl || !workerSecret) {
    return Response.json(
      {
        success: false,
        message: "Missing AIVENTRA_APP_URL or AIVENTRA_WORKER_SECRET.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }

  const response = await fetch(`${appUrl}/api/internal/jobs/schedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      limit: 10,
    }),
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});
