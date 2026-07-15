import type {
  ProductLifecycleStage,
  ProductLifecycleStatus,
} from "./ProductLifecycle";

export interface LifecycleTransition {
  from?: ProductLifecycleStage;
  to: ProductLifecycleStage;
  reason: string;
  timestamp: string;
  actor: string;
  status: ProductLifecycleStatus;
}
