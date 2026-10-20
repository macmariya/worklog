import Link from "next/link";

// 月次レポート（F06〜F08）は Phase 2 で作る
export default async function MonthPage({ params }: PageProps<"/month/[month]">) {
  const { month } = await params;
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">{month} の月次レポート</h1>
      <p className="text-sm text-slate-500">月次レポートと CSV 出力は次の段階（Phase 2）で作ります。</p>
      <Link href="/" className="text-sm underline">
        ホームへ
      </Link>
    </div>
  );
}
