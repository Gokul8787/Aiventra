import type { IntelligenceEngine } from "./IntelligenceEngine";

const registry: IntelligenceEngine[] = [];

export function registerIntelligenceEngine(engine: IntelligenceEngine) {
  const alreadyRegistered = registry.some(
    (registeredEngine) => registeredEngine.id === engine.id
  );

  if (!alreadyRegistered) {
    registry.push(engine);
  }
}

export function getRegisteredEngines() {
  return [...registry];
}
