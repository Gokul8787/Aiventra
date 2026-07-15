import { DomainEvent, DomainEventType } from "@/events/types";

export interface EventHandler {
  name: string;
  eventType: DomainEventType;

  handle(event: DomainEvent): Promise<void>;
}
