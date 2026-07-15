import { registerEvidenceProvider } from "../EvidenceRegistry";
import { CJInventoryProvider } from "./cj/inventoryProvider";
import { CJProductCostProvider } from "./cj/productCostProvider";
import { CJShippingProvider } from "./cj/shippingProvider";

registerEvidenceProvider(new CJProductCostProvider());
registerEvidenceProvider(new CJInventoryProvider());
registerEvidenceProvider(new CJShippingProvider());
