import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

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

    // Ensure upload dir exists
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Unique filename: timestamp + random suffix + original extension
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ALLOWED_TYPES.includes(file.type) && ext.length <= 4 ? ext : "jpg";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
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
export async function GET() {
  return NextResponse.json({ ok: true, message: "Upload endpoint. Use POST with multipart/form-data." });
}
