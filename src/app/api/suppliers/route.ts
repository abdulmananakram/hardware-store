import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { errorResponse } from "@/server/api";
import { createSupplier, listSuppliers } from "@/server/services/supplierService";

const schema = z.object({ name: z.string().min(1), phone: z.string().optional() });

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  return NextResponse.json(await listSuppliers());
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await createSupplier(parsed.data.name, parsed.data.phone), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

