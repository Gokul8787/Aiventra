import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/services/supabase/admin";

const DEFAULT_ORGANISATION_ID =
  process.env.DEFAULT_ORGANISATION_ID ||
  "00000000-0000-4000-8000-000000000001";

const DEFAULT_STORE_ID =
  process.env.DEFAULT_STORE_ID || "00000000-0000-4000-8000-000000000002";

const RegistrationSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().max(120).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let createdUserId: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = RegistrationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Enter a valid email address and a password of at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const { email, password, fullName } = parsed.data;

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });

    if (createError || !createdUser.user) {
      const message =
        createError?.message || "Unable to create your Aiventra account.";
      const alreadyExists = message.toLowerCase().includes("already");

      return NextResponse.json(
        {
          success: false,
          message: alreadyExists
            ? "An account with this email already exists. Please sign in."
            : message,
        },
        { status: alreadyExists ? 409 : 400 }
      );
    }

    createdUserId = createdUser.user.id;

    const { error: organisationError } = await supabaseAdmin
      .from("organisation_members")
      .upsert(
        {
          organisation_id: DEFAULT_ORGANISATION_ID,
          user_id: createdUserId,
          role: "operator",
          status: "active",
          joined_at: new Date().toISOString(),
        },
        { onConflict: "organisation_id,user_id" }
      );

    if (organisationError) {
      throw new Error(
        `Unable to grant organisation access: ${organisationError.message}`
      );
    }

    const { error: storeError } = await supabaseAdmin
      .from("store_members")
      .upsert(
        {
          store_id: DEFAULT_STORE_ID,
          user_id: createdUserId,
          role: "operator",
          status: "active",
        },
        { onConflict: "store_id,user_id" }
      );

    if (storeError) {
      throw new Error(`Unable to grant store access: ${storeError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        userId: createdUserId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {
        // Best-effort rollback. The original registration error is returned below.
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to create your Aiventra account.",
      },
      { status: 500 }
    );
  }
}
