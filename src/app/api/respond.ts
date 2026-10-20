import { z } from "zod";
import { AppError } from "@/lib/errors";

export function apiError(e: unknown) {
  if (e instanceof AppError) return Response.json({ error: e.message }, { status: 409 });
  if (e instanceof z.ZodError || e instanceof SyntaxError) {
    return Response.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }
  console.error(e);
  return Response.json({ error: "internal error" }, { status: 500 });
}
