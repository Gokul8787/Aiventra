export type DecisionThresholds = {
  publish: {
    minimumOverallScore: number;
    minimumConfidence: number;
    minimumProfitScore: number;
    minimumShippingScore: number;
    minimumSupplierScore: number;
    minimumDemandScore: number;
    minimumCompetitionOpportunity: number;
  };

  buy: {
    minimumOverallScore: number;
    minimumConfidence: number;
  };

  watch: {
    minimumOverallScore: number;
  };

  automation: {
    minimumConfidence: number;
    allowEstimatedData: boolean;
  };
};

export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = {
  publish: {
    minimumOverallScore: 82,
    minimumConfidence: 80,
    minimumProfitScore: 70,
    minimumShippingScore: 70,
    minimumSupplierScore: 75,
    minimumDemandScore: 75,
    minimumCompetitionOpportunity: 40,
  },

  buy: {
    minimumOverallScore: 75,
    minimumConfidence: 70,
  },

  watch: {
    minimumOverallScore: 60,
  },

  automation: {
    minimumConfidence: 85,
    allowEstimatedData: false,
  },
};
