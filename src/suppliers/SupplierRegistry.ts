import type { SupplierConnector } from "./SupplierConnector";
import type { SupplierProvider } from "./types";

const connectors = new Map<SupplierProvider, SupplierConnector>();

export function registerSupplierConnector(connector: SupplierConnector): void {
  if (connectors.has(connector.id)) {
    throw new Error(`Supplier connector already registered: ${connector.id}`);
  }

  connectors.set(connector.id, connector);
}

export function getSupplierConnector(
  provider: SupplierProvider
): SupplierConnector {
  const connector = connectors.get(provider);

  if (!connector) {
    throw new Error(`Supplier connector is not registered: ${provider}`);
  }

  return connector;
}

export function getRegisteredSupplierConnectors(): SupplierConnector[] {
  return Array.from(connectors.values());
}

export function clearSupplierConnectors(): void {
  connectors.clear();
}
