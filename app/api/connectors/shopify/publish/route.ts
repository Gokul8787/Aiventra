import { NextResponse } from "next/server";
import type { Product } from "@/ai/types/product";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  AuthorisationError,
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { ProductSchema } from "@/validation/productSchemas";
import { generatePublishingPackage } from "@/ai/publishing/publishingEngine";
import { publishToShopify } from "@/services/connectors/shopify/products";
import { moveIfAllowed } from "@/lifecycle/ProductLifecycleService";
import { enforceRateLimit } from "@/security/rateLimiter";
import { writeAuditLog } from "@/security/auditLogger";
import { saveShopifyPublication } from "@/services/repositories/publicationRepository";
import { upsertPublishedProductSupplierMapping } from "@/services/repositories/supplierFulfilmentRepository";

export async function POST(request: Request) {
  let context: AuthenticatedApiContext | undefined;

  try {
    const body = await request.json();
    context = await requireApiContext(request, "shopify.publish_draft");

    await enforceRateLimit(`user:${context.user.id}`, {
      route: "shopify-draft-publishing",
      maximumRequests: 20,
      windowSeconds: 3600,
    });

    const tenantContext = context.tenantContext;
    const parsed = ProductSchema.safeParse(body.product);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product data.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const product = {
      ...(parsed.data as Product),
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
    };

    // Always regenerate server-side.
    const publishingPackage = await generatePublishingPackage({
      product,
      brandName: "Aiventra",
      targetMarket: "United Kingdom",
    });

    if (!publishingPackage.validationPassed) {
      return NextResponse.json(
        {
          success: false,
          message: "The server-generated publishing package failed validation.",
          errors: publishingPackage.validationErrors,
        },
        { status: 400 }
      );
    }

    const result = await publishToShopify(tenantContext, {
      title: publishingPackage.title,
      description: publishingPackage.description,
      price: publishingPackage.sellPrice,
      compareAtPrice: publishingPackage.compareAtPrice,
      tags: publishingPackage.tags,
        collections: publishingPackage.collections,
        handle: publishingPackage.handle,
        imageUrl: product.imageUrl,
        imageAltText: publishingPackage.imageAltText,
        seoTitle: publishingPackage.seoTitle,
      seoDescription: publishingPackage.seoDescription,
      productType: product.category,
      vendor: "Aiventra",
    });

    const lifecycleTransition = product.databaseId
      ? await moveIfAllowed({
          tenantContext,
          product,
          productId: product.databaseId,
          to: "DRAFT_CREATED",
          actor: "shopify-connector",
          reason: "Shopify draft product created.",
        })
      : null;

    if (product.databaseId && result.externalId) {
      await saveShopifyPublication({
        tenantContext,
        productId: product.databaseId,
        externalProductId: result.externalId,
        externalVariantId: result.externalVariantId,
        externalUrl: result.externalUrl,
        status: "draft",
      });

      await upsertPublishedProductSupplierMapping({
        context: tenantContext,
        product,
      });
    }

    await writeAuditLog({
      context,
      request,
      action: "shopify.draft_created",
      resourceType: "product_publication",
      resourceId: result.externalId,
      outcome: "success",
      metadata: {
        productId: product.databaseId,
        shopifyProductId: result.externalId,
        shopifyUrl: result.externalUrl,
      },
    });

    return NextResponse.json({
      success: true,
      tenantContext,
      result,
      publishingPackage,
      product: lifecycleTransition
        ? {
            ...product,
            currentLifecycle: lifecycleTransition.to,
            lifecycleStatus: lifecycleTransition.status,
            lifecycleChangedAt: lifecycleTransition.timestamp,
          }
        : product,
      publishedAt: new Date().toISOString(),
    });
  } catch (error) {
    await writeAuditLog({
      context,
      request,
      action: "shopify.draft_created",
      resourceType: "product_publication",
      outcome: error instanceof AuthorisationError ? "denied" : "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
