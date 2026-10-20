import { BottomNav } from "@/components/BottomNav";
import { jstDate } from "@/lib/time";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">{children}</main>
      <BottomNav today={jstDate(new Date())} />
    </>
  );
}
