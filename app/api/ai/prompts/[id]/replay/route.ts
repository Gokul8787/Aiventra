import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getPrompt } from "@/services/aiAudit/AIAuditRepository";
import { AIService, OPENAI_MODEL } from "@/services/openai/OpenAIService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "audit.read");
    const tenantContext = apiContext.tenantContext;
    const prompt = await getPrompt(tenantContext, id);

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          message: "Prompt not found.",
        },
        { status: 404 }
      );
    }

    const result = await AIService.generate({
      feature: prompt.feature,
      tenantContext,
      model: OPENAI_MODEL,
      version: prompt.promptVersion,
      systemPrompt: prompt.systemPrompt || "",
      userPrompt: prompt.userPrompt || "",
      input: {
        replayOfPromptId: prompt.id,
        originalInput: prompt.input,
      },
      jobId: prompt.jobId,
      productId: prompt.productId,
      templateId:
        typeof prompt.input === "object" &&
        prompt.input !== null &&
        "templateId" in prompt.input
          ? String(prompt.input.templateId || "")
          : undefined,
      templateVersion: prompt.promptVersion,
    });

    return NextResponse.json({
      success: true,
      tenantContext,
      result,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
