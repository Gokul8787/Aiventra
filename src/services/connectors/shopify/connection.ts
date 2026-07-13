import { shopifyGraphQL } from "./client";

type ShopifyConnectionData = {
  shop: {
    id: string;
    name: string;
    myshopifyDomain: string;
    primaryDomain: {
      url: string;
    };
    currencyCode: string;
  };
};

export type ShopifyConnectionResult = {
  connected: boolean;
  id: string;
  name: string;
  myshopifyDomain: string;
  storefrontUrl: string;
  currencyCode: string;
};

const SHOP_CONNECTION_QUERY = `
  query AiventraShopConnection {
    shop {
      id
      name
      myshopifyDomain
      primaryDomain {
        url
      }
      currencyCode
    }
  }
`;

export async function testShopifyConnection(): Promise<ShopifyConnectionResult> {
  const data = await shopifyGraphQL<ShopifyConnectionData>(
    SHOP_CONNECTION_QUERY
  );

  return {
    connected: true,
    id: data.shop.id,
    name: data.shop.name,
    myshopifyDomain: data.shop.myshopifyDomain,
    storefrontUrl: data.shop.primaryDomain.url,
    currencyCode: data.shop.currencyCode,
  };
}
