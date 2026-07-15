import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import {
  createAutomationRule,
  listAutomationRules,
} from "@/services/repositories/rulesRepository";
import { AutomationRuleInputSchema } from "@/validation/ruleSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "rules.read");
    const rules = await listAutomationRules(context.tenantContext);

    return NextResponse.json({
      success: true,
      tenantContext: context.tenantContext,
      rules,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireApiContext(request, "rules.manage");
    const body = await request.json();
    const parsed = AutomationRuleInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid automation rule.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const rule = await createAutomationRule(context.tenantContext, parsed.data);

    return NextResponse.json(
      {
        success: true,
        tenantContext: context.tenantContext,
        rule,
      },
      { status: 201 }
    );
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
