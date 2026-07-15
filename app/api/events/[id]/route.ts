import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { supabaseAdmin } from "@/services/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "jobs.read");

    const { data, error } = await supabaseAdmin
      .from("domain_events")
      .select(
        `
        id,
        event_type,
        status,
        attempts,
        max_attempts,
        last_error,
        created_at,
        processed_at
      `
      )
      .eq("organisation_id", apiContext.tenantContext.organisationId)
      .eq("store_id", apiContext.tenantContext.storeId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "Event not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantContext: apiContext.tenantContext,
      event: data,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
