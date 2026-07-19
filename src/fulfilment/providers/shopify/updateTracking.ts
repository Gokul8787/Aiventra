import { shopifyGraphQL } from "@/services/connectors/shopify/client";
import type { UpdateTrackingInput } from "../FulfilmentProvider";
import type { ShopifyFulfilmentTrackingUpdateMutation } from "./types";

const UPDATE_TRACKING_MUTATION = `
  mutation AiventraFulfillmentTrackingInfoUpdate(
    $fulfillmentId: ID!
    $trackingInfoInput: FulfillmentTrackingInput!
    $notifyCustomer: Boolean
  ) {
    fulfillmentTrackingInfoUpdate(
      fulfillmentId: $fulfillmentId
      trackingInfoInput: $trackingInfoInput
      notifyCustomer: $notifyCustomer
    ) {
      fulfillment {
        id
        status
        trackingInfo(first: 10) {
          company
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function updateShopifyFulfilmentTracking(
  input: UpdateTrackingInput
): Promise<void> {
  const data = await shopifyGraphQL<ShopifyFulfilmentTrackingUpdateMutation>(
    UPDATE_TRACKING_MUTATION,
    {
      fulfillmentId: input.externalFulfilmentId,
      trackingInfoInput: {
        company: input.carrier || undefined,
        number: input.trackingNumber,
        url: input.trackingUrl || undefined,
        numbers: [input.trackingNumber],
        urls: input.trackingUrl ? [input.trackingUrl] : [],
      },
      notifyCustomer: input.notifyCustomer,
    }
  );

  const errors = data.fulfillmentTrackingInfoUpdate.userErrors || [];

  if (errors.length) {
    throw new Error(
      `Shopify tracking update failed: ${errors.map((error) => error.message).join("; ")}`
    );
  }
}
