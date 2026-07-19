export type DiscoveryCategory = {
  id: string;
  name: string;
  searchQueries: string[];
  enabled: boolean;
  maximumProductsPerQuery: number;
};

export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  {
    id: "home-kitchen",
    name: "Home & Kitchen",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "kitchen gadget",
      "home organiser",
      "cleaning tool",
      "storage solution",
      "portable appliance",
    ],
  },
  {
    id: "beauty-personal-care",
    name: "Beauty & Personal Care",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "beauty tool",
      "hair styling",
      "skin care device",
      "personal care",
      "makeup organiser",
    ],
  },
  {
    id: "pet",
    name: "Pet Supplies",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "pet accessory",
      "dog accessory",
      "cat accessory",
      "pet feeder",
      "pet grooming",
    ],
  },
  {
    id: "fitness",
    name: "Fitness",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "home fitness",
      "gym accessory",
      "yoga accessory",
      "recovery tool",
      "portable exercise",
    ],
  },
  {
    id: "car-accessories",
    name: "Car Accessories",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "car accessory",
      "car cleaning",
      "car organiser",
      "phone holder car",
      "vehicle gadget",
    ],
  },
  {
    id: "electronics",
    name: "Consumer Electronics",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "phone accessory",
      "smart home gadget",
      "portable charger",
      "LED gadget",
      "desk electronic",
    ],
  },
  {
    id: "baby-family",
    name: "Baby & Family",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "baby accessory",
      "family organiser",
      "child safety",
      "feeding accessory",
    ],
  },
  {
    id: "garden-outdoor",
    name: "Garden & Outdoor",
    enabled: true,
    maximumProductsPerQuery: 10,
    searchQueries: [
      "garden tool",
      "outdoor accessory",
      "camping gadget",
      "solar garden",
    ],
  },
];

export const DISCOVERY_SETTINGS = {
  maximumTotalProducts: 100,
  maximumQueriesPerRun: 20,
  minimumStock: 20,
  maximumSupplierPrice: 50,
  maximumShippingDays: 14,
  minimumEstimatedMarginPercent: 20,
} as const;
