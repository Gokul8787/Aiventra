import { EventHandler } from "./handlers/types";
import { DomainEventType } from "./types";

const handlers = new Map<DomainEventType, EventHandler[]>();

export function registerEventHandler(handler: EventHandler): void {
  const existing = handlers.get(handler.eventType) || [];

  if (existing.some((registered) => registered.name === handler.name)) {
    return;
  }

  handlers.set(handler.eventType, [...existing, handler]);
}

export function getEventHandlers(eventType: DomainEventType): EventHandler[] {
  return handlers.get(eventType) || [];
}
