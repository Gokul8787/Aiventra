import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import {
  disableAutomationRule,
  getAutomationRule,
  updateAutomationRule,
} from "@/services/repositories/rulesRepository";
import { AutomationRulePatchSchema } from "@/validation/ruleSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "rules.read");
    const rule = await getAutomationRule(apiContext.tenantContext, id);

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          message: "Rule not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantContext: apiContext.tenantContext,
      rule,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "rules.manage");
    const body = await request.json();
    const parsed = AutomationRulePatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid automation rule update.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const rule = await updateAutomationRule(
      apiContext.tenantContext,
      id,
      parsed.data
    );

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          message: "Rule not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantContext: apiContext.tenantContext,
      rule,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "rules.manage");

    await disableAutomationRule(apiContext.tenantContext, id);

    return NextResponse.json({
      success: true,
      tenantContext: apiContext.tenantContext,
      disabled: true,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
