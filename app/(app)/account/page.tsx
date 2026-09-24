import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountPanel } from "@/app/ui/account-panel";
import { auth } from "@/lib/auth";

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-8">
      <AccountPanel email={session.user.email} />
    </main>
  );
}
