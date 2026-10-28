import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireAuth } from "@/server/auth";

// ============================================================
// POST /api/upload
// Accepts multipart form with file field "file"
// Saves to /public/uploads/<unique-name>.<ext>
// Returns { url: "/uploads/<unique-name>.<ext>" }
// ============================================================

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: true, message: "No file provided. Use multipart/form-data with field name 'file'." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: true,
          message: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: true, message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 5 MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const signatureValid =
      (file.type === "image/jpeg" || file.type === "image/jpg") &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff ||
      file.type === "image/png" &&
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      file.type === "image/gif" &&
      buffer.subarray(0, 6).toString("ascii") === "GIF8" ||
      file.type === "image/webp" &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!signatureValid) {
      return NextResponse.json({ error: true, message: "File signature does not match its type" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Unique filename: timestamp + random suffix + original extension
    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const uniqueName = `${crypto.randomUUID()}.${extensionByType[file.type]}`;
    const filePath = path.join(uploadDir, uniqueName);

    await writeFile(filePath, buffer);

    const url = `/uploads/${uniqueName}`;
    return NextResponse.json({ url, size: file.size, type: file.type });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: true, message: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// Optional: GET to verify endpoint is up
export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  return NextResponse.json({ ok: true, message: "Upload endpoint. Use POST with multipart/form-data." });
}
