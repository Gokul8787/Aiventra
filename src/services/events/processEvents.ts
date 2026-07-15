import "server-only";

import { randomUUID } from "crypto";

import { getEventHandlers } from "@/events/handlerRegistry";
import { registerHandlers } from "@/events/registerHandlers";
import {
  claimPendingEvents,
  completeEvent,
  completeEventDelivery,
  failEvent,
  failEventDelivery,
  startEventDelivery,
} from "./eventRepository";

export async function processEvents(input?: {
  limit?: number;
  workerId?: string;
}) {
  registerHandlers();

  const workerId = input?.workerId || `aiventra-${randomUUID()}`;
  const events = await claimPendingEvents({
    workerId,
    limit: input?.limit ?? 10,
  });

  const results = [];

  for (const event of events) {
    try {
      const handlers = getEventHandlers(event.eventType);

      for (const handler of handlers) {
        await startEventDelivery(
          event.id,
          handler.name,
          event.tenantContext
        );

        try {
          await handler.handle(event);
          await completeEventDelivery(event.id, handler.name);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown event handler error";

          await failEventDelivery(event.id, handler.name, message);
          throw error;
        }
      }

      await completeEvent(event.id);

      results.push({
        eventId: event.id,
        eventType: event.eventType,
        handlers: handlers.map((handler) => handler.name),
        status: "completed",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown event processing error";

      await failEvent(event, message);

      results.push({
        eventId: event.id,
        eventType: event.eventType,
        status: "failed",
        message,
      });
    }
  }

  return {
    workerId,
    processed: results.length,
    results,
  };
}
