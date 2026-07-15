import { JobHandler } from "./handlers/types";
import { JobType } from "./types";

const handlers = new Map<JobType, JobHandler>();

export function registerJobHandler(handler: JobHandler): void {
  handlers.set(handler.jobType, handler);
}

export function getJobHandler(jobType: JobType): JobHandler | undefined {
  return handlers.get(jobType);
}
