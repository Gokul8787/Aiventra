import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getProductWorkspace } from "@/services/products/getProductWorkspace";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "products.read");

    const workspace = await getProductWorkspace(apiContext.tenantContext, id);

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          message: "Product not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
