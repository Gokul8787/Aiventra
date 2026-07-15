import { PublishProductInput, PublishResult } from "../types";
import type { TenantContext } from "@/context/storeContext";
import { shopifyGraphQL } from "./client";

type ShopifyUserError = {
  field?: string[];
  message: string;
};

type ProductByHandleData = {
  productByHandle: {
    id: string;
    title: string;
    handle: string;
    status: string;
  } | null;
};

type ProductCreateData = {
  productCreate: {
    product: {
      id: string;
      title: string;
      handle: string;
      status: string;
      variants: {
        nodes: Array<{
          id: string;
          price: string;
          compareAtPrice?: string | null;
        }>;
      };
    } | null;
    userErrors: ShopifyUserError[];
  };
};

type VariantUpdateData = {
  productVariantsBulkUpdate: {
    productVariants: Array<{
      id: string;
      price: string;
      compareAtPrice?: string | null;
    }> | null;
    userErrors: ShopifyUserError[];
  };
};

const PRODUCT_BY_HANDLE_QUERY = `
  query AiventraProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      handle
      status
    }
  }
`;

const CREATE_PRODUCT_MUTATION = `
  mutation AiventraCreateDraftProduct(
    $product: ProductCreateInput!
    $media: [CreateMediaInput!]
  ) {
    productCreate(product: $product, media: $media) {
      product {
        id
        title
        handle
        status
        variants(first: 1) {
          nodes {
            id
            price
            compareAtPrice
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_VARIANT_MUTATION = `
  mutation AiventraUpdateVariant(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
  ) {
    productVariantsBulkUpdate(
      productId: $productId
      variants: $variants
    ) {
      productVariants {
        id
        price
        compareAtPrice
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function formatErrors(errors: ShopifyUserError[]): string {
  return errors
    .map((error) => {
      const field = error.field?.length ? `${error.field.join(".")}: ` : "";

      return `${field}${error.message}`;
    })
    .join("; ");
}

function getNumericShopifyId(graphqlId: string): string {
  return graphqlId.split("/").pop() || graphqlId;
}

async function findExistingProduct(handle: string) {
  const data = await shopifyGraphQL<ProductByHandleData>(
    PRODUCT_BY_HANDLE_QUERY,
    { handle }
  );

  return data.productByHandle;
}

export async function publishToShopify(
  _tenantContext: TenantContext,
  product: PublishProductInput
): Promise<PublishResult> {
  const existingProduct = await findExistingProduct(product.handle);

  if (existingProduct) {
    const numericId = getNumericShopifyId(existingProduct.id);
    const configuredDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();

    return {
      success: true,
      externalId: existingProduct.id,
      externalUrl: configuredDomain
        ? `https://${configuredDomain}/admin/products/${numericId}`
        : undefined,
      message: `"${existingProduct.title}" already exists in Shopify as ${existingProduct.status.toLowerCase()}.`,
    };
  }

  const media = product.imageUrl
    ? [
        {
          originalSource: product.imageUrl,
          alt: product.imageAltText || product.title,
          mediaContentType: "IMAGE",
        },
      ]
    : [];

  const createData = await shopifyGraphQL<ProductCreateData>(
    CREATE_PRODUCT_MUTATION,
    {
      product: {
        title: product.title,
        descriptionHtml: product.description,
        handle: product.handle,
        productType: product.productType || "",
        vendor: product.vendor || "Aiventra",
        status: "DRAFT",
        tags: product.tags,
        seo: {
          title: product.seoTitle || product.title,
          description: product.seoDescription || "",
        },
      },
      media,
    }
  );

  const createResult = createData.productCreate;

  if (createResult.userErrors.length > 0) {
    throw new Error(
      `Shopify product creation failed: ${formatErrors(
        createResult.userErrors
      )}`
    );
  }

  if (!createResult.product) {
    throw new Error("Shopify did not return the created product.");
  }

  const createdProduct = createResult.product;
  const initialVariant = createdProduct.variants.nodes[0];

  if (!initialVariant) {
    throw new Error("Shopify created the product without an initial variant.");
  }

  const variantData = await shopifyGraphQL<VariantUpdateData>(
    UPDATE_VARIANT_MUTATION,
    {
      productId: createdProduct.id,
      variants: [
        {
          id: initialVariant.id,
          price: product.price,
          compareAtPrice:
            product.compareAtPrice && product.compareAtPrice > product.price
              ? product.compareAtPrice
              : null,
        },
      ],
    }
  );

  const variantResult = variantData.productVariantsBulkUpdate;

  if (variantResult.userErrors.length > 0) {
    throw new Error(
      `Shopify pricing update failed: ${formatErrors(
        variantResult.userErrors
      )}`
    );
  }

  const numericId = getNumericShopifyId(createdProduct.id);
  const configuredDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();

  return {
    success: true,
    externalId: createdProduct.id,
    externalVariantId: initialVariant.id,
    externalUrl: configuredDomain
      ? `https://${configuredDomain}/admin/products/${numericId}`
      : undefined,
    message: `"${createdProduct.title}" was created as a Shopify draft.`,
  };
}
