import { registerProvider } from "./providerRegistry";
import { amazonProvider } from "./providers/amazon";
import { cjDropshippingProvider } from "./providers/cjdropshipping";
import { googleTrendsProvider } from "./providers/googleTrends";
import { redditProvider } from "./providers/reddit";

registerProvider(googleTrendsProvider);
registerProvider(amazonProvider);
registerProvider(redditProvider);
registerProvider(cjDropshippingProvider);
