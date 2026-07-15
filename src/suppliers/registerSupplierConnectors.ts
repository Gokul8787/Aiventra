import { CJConnector } from "./connectors/CJConnector";
import { registerSupplierConnector } from "./SupplierRegistry";

let registered = false;

export function registerSupplierConnectors(): void {
  if (registered) return;

  registerSupplierConnector(new CJConnector());

  registered = true;
}
