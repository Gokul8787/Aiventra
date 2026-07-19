import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";

type WorkerHeartbeatStatus = "healthy" | "warning" | "offline";

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

export async function recordWorkerHeartbeat(input: {
  workerId: string;
  queueName: string;
  tenantContext?: Partial<TenantContext>;
  version?: string;
  host?: string;
  status?: WorkerHeartbeatStatus;
  memoryMb?: number;
  cpuPercent?: number;
  metadata?: Record<string, unknown>;
}) {
  const workerKey = [
    input.tenantContext?.organisationId || "global",
    input.tenantContext?.storeId || "global",
    input.queueName,
    input.workerId,
  ].join(":");

  const { error } = await supabaseAdmin.from("worker_heartbeats").upsert(
    {
      organisation_id: input.tenantContext?.organisationId || null,
      store_id: input.tenantContext?.storeId || null,
      worker_key: workerKey,
      worker_id: input.workerId,
      queue_name: input.queueName,
      version: input.version || process.env.npm_package_version || "dev",
      host:
        input.host ||
        process.env.VERCEL_URL ||
        process.env.HOSTNAME ||
        "local",
      status: input.status || "healthy",
      memory_mb:
        input.memoryMb ??
        Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      cpu_percent: input.cpuPercent ?? null,
      metadata: toJson(input.metadata),
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "worker_key",
    }
  );

  if (error) {
    throw new Error(`Failed to record worker heartbeat: ${error.message}`);
  }
}
