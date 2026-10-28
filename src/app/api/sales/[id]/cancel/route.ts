import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { cancelSale } from "@/server/services/cancelService";

const schema = z.object({ reason: z.string().min(1) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const id = Number((await context.params).id);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: true, message: "Valid id and cancellation reason are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await cancelSale(id, parsed.data.reason));
  } catch (error) {
    return errorResponse(error);
  }
}

