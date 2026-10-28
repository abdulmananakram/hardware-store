import { NextResponse } from "next/server";
import { ServiceError } from "./services/shared";

export const errorResponse = (error: unknown) => {
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: true, message: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: true, message: "Internal server error" }, { status: 500 });
};

