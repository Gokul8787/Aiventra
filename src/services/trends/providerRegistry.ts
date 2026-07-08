import { TrendProvider } from "./types";

const providers: TrendProvider[] = [];

export function registerProvider(provider: TrendProvider) {
  providers.push(provider);
}

export function getProviders() {
  return providers;
}
