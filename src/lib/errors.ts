/** 画面にそのまま出してよいエラー */
export class AppError extends Error {}

/** postgres.js のエラー（drizzle が cause に包む場合もある）から SQLSTATE と制約名を取り出す */
export function pgError(e: unknown): { code?: string; constraint?: string } {
  const pick = (x: unknown) =>
    x && typeof x === "object" && "code" in x
      ? {
          code: String((x as { code: unknown }).code),
          constraint: (x as { constraint_name?: string }).constraint_name,
        }
      : undefined;
  return pick(e) ?? pick((e as { cause?: unknown })?.cause) ?? {};
}
