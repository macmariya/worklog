import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-sm px-4 pt-24">
      <h1 className="mb-8 text-center text-2xl font-bold">worklog</h1>
      <LoginForm next={typeof next === "string" ? next : "/"} />
    </main>
  );
}
