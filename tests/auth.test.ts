import { beforeAll, describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, verifySessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "x".repeat(64);
  process.env.APP_PASSWORD = "correct horse";
});

describe("auth", () => {
  it("パスワードの一致・不一致", async () => {
    expect(await checkPassword("correct horse")).toBe(true);
    expect(await checkPassword("correct hors")).toBe(false);
    expect(await checkPassword("")).toBe(false);
  });

  it("発行したトークンは通り、改ざん・期限切れは通らない", async () => {
    const now = Date.UTC(2026, 9, 20);
    const t = await createSessionToken(now);
    expect(await verifySessionToken(t, now)).toBe(true);
    const [v, exp, sig] = t.split(".");
    expect(await verifySessionToken(`${v}.${Number(exp) + 1}.${sig}`, now)).toBe(false);
    expect(await verifySessionToken(`${v}.${exp}.${sig.slice(0, -1)}A`, now)).toBe(false);
    expect(await verifySessionToken(t, now + 91 * 24 * 3600 * 1000)).toBe(false);
    expect(await verifySessionToken(undefined, now)).toBe(false);
  });

  it("署名鍵が変わると無効になる", async () => {
    const t = await createSessionToken();
    process.env.AUTH_SECRET = "y".repeat(64);
    expect(await verifySessionToken(t)).toBe(false);
    process.env.AUTH_SECRET = "x".repeat(64);
  });
});
