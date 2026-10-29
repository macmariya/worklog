import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 全ページが DB と Cookie に依存する動的ページなので、ISR のキャッシュ置き場は持たない
export default defineCloudflareConfig();
