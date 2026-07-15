import type { EvidenceProvider } from "./types";

const providers: EvidenceProvider[] = [];

export function registerEvidenceProvider(provider: EvidenceProvider) {
  const alreadyRegistered = providers.some(
    (registeredProvider) =>
      registeredProvider.id === provider.id &&
      registeredProvider.category === provider.category
  );

  if (!alreadyRegistered) {
    providers.push(provider);
  }
}

export function getEvidenceProviders() {
  return providers.filter((provider) => provider.enabled);
}

export function clearEvidenceProvidersForTests() {
  providers.splice(0, providers.length);
}
