import { registerProvider } from "./providerRegistry";
import { amazonProvider } from "./providers/amazon";
import { googleTrendsProvider } from "./providers/googleTrends";
import { redditProvider } from "./providers/reddit";

registerProvider(googleTrendsProvider);
registerProvider(amazonProvider);
registerProvider(redditProvider);
