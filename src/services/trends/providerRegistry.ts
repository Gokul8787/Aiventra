import { TrendProvider } from "./types";

const providers: TrendProvider[] = [];

export function registerProvider(provider: TrendProvider) {
  const alreadyRegistered = providers.some((p) => p.name === provider.name);

  if (!alreadyRegistered) {
    providers.push(provider);
  }
}

export function getProviders() {
  return providers;
}
