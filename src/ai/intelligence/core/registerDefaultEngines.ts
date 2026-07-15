import { CompetitionEngine } from "../competitionEngine";
import { ConfidenceEngine } from "../confidenceEngine";
import { DemandEngine } from "../demandEngine";
import { ProfitEngine } from "../profitEngine";
import { ReviewsEngine } from "../reviewEngine";
import { SeasonalityEngine } from "../seasonalityEngine";
import { ShippingEngine } from "../shippingEngine";
import { SupplierEngine } from "../supplierEngine";
import { registerIntelligenceEngine } from "./IntelligenceRegistry";

registerIntelligenceEngine(new DemandEngine());
registerIntelligenceEngine(new ProfitEngine());
registerIntelligenceEngine(new ShippingEngine());
registerIntelligenceEngine(new SupplierEngine());
registerIntelligenceEngine(new ReviewsEngine());
registerIntelligenceEngine(new CompetitionEngine());
registerIntelligenceEngine(new SeasonalityEngine());
registerIntelligenceEngine(new ConfidenceEngine());
