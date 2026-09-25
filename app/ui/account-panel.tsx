"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/app/ui/change-password-form";
import { authClient } from "@/lib/auth-client";

export function AccountPanel({ email }: { email: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-4xl font-medium">Account</h1>
        <p className="text-muted-foreground">{email}</p>
      </div>
      <ChangePasswordForm />
      <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  );
}
