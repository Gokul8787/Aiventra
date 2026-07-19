import type { FulfilmentProvider } from "./FulfilmentProvider";

const providers = new Map<string, FulfilmentProvider>();

export function registerFulfilmentProvider(provider: FulfilmentProvider) {
  if (!providers.has(provider.id)) {
    providers.set(provider.id, provider);
  }
}

export function getFulfilmentProvider(id: string): FulfilmentProvider {
  const provider = providers.get(id);

  if (!provider) {
    throw new Error(`No fulfilment provider registered for "${id}".`);
  }

  return provider;
}

export function getFulfilmentProviders(): FulfilmentProvider[] {
  return Array.from(providers.values());
}
