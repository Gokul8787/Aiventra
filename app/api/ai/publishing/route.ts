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
import { moveIfAllowed } from "@/lifecycle/ProductLifecycleService";
import { evaluateProductRules } from "@/services/rules/evaluateProductRules";
import { enforceRateLimit } from "@/security/rateLimiter";
import { writeAuditLog } from "@/security/auditLogger";

export async function POST(request: Request) {
  let context: AuthenticatedApiContext | undefined;

  try {
    const body = await request.json();
    context = await requireApiContext(request, "listing.generate");

    await enforceRateLimit(`user:${context.user.id}`, {
      route: "listing-generation",
      maximumRequests: 30,
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

    const publishingPackage = await generatePublishingPackage({
      product,
      brandName: "Aiventra",
      targetMarket: "United Kingdom",
    });

    const lifecycleTransition = product.databaseId
      ? await moveIfAllowed({
          tenantContext,
          product,
          productId: product.databaseId,
          to: "LISTING_GENERATED",
          actor: "publishing-engine",
          reason: "Publishing package generated.",
        })
      : null;
    const updatedProduct = lifecycleTransition
      ? {
          ...product,
          currentLifecycle: lifecycleTransition.to,
          lifecycleStatus: lifecycleTransition.status,
          lifecycleChangedAt: lifecycleTransition.timestamp,
        }
      : product;

    if (product.databaseId) {
      await evaluateProductRules({
        organisationId: tenantContext.organisationId,
        storeId: tenantContext.storeId,
        product: updatedProduct,
        productDatabaseId: product.databaseId,
        inventory: {
          currentStock: product.stock,
        },
        lifecycle: {
          stage: updatedProduct.currentLifecycle,
          status: updatedProduct.lifecycleStatus,
        },
      });
    }

    await writeAuditLog({
      context,
      request,
      action: "listing.generated",
      resourceType: "publishing_package",
      resourceId: product.databaseId,
      outcome: "success",
      metadata: {
        productId: product.databaseId,
        validationPassed: publishingPackage.validationPassed,
      },
    });

    return NextResponse.json({
      success: true,
      tenantContext,
      product: updatedProduct,
      publishingPackage,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    await writeAuditLog({
      context,
      request,
      action: "listing.generated",
      resourceType: "publishing_package",
      outcome: error instanceof AuthorisationError ? "denied" : "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
