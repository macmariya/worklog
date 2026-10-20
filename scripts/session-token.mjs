// 動作確認用: AUTH_SECRET からセッション Cookie の値を作る（src/lib/auth.ts と同じ形式）。
//   docker compose exec -T app node scripts/session-token.mjs
// 出力は秘密情報として扱い、ログやチャットに残さない
import { createHmac } from "node:crypto";

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("AUTH_SECRET が未設定です");
const body = `v1.${Math.floor(Date.now() / 1000) + 10 * 60}`; // 10 分だけ有効
process.stdout.write(`${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`);
