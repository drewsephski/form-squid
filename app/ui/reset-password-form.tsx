"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token, error }: { token: string; error: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (error || !token) {
    return (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>This reset link is invalid or expired.</p>
        <p>
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </div>
    );
  }

  async function handleSubmit() {
    if (password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    setPending(true);
    setMessage("");
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message ?? "Could not reset the password.");
      return;
    }
    router.push("/sign-in");
  }

  return (
    <form
      className="mx-auto grid w-full max-w-sm gap-4 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmation">Confirm password</Label>
        <Input id="confirmation" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving" : "Save password"}
      </Button>
    </form>
  );
}
