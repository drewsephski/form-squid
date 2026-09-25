"use client";

import { useState } from "react";
import { AnimateHeight } from "@/components/ui/animate-height";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (newPassword !== confirmation) {
      setSaved(false);
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    setSaved(false);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not change the password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setSaved(true);
  }

  return (
    <AnimateHeight>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Change password</h2>
          <p className="text-sm text-muted-foreground">Other signed-in sessions are signed out.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-muted-foreground">Password updated.</p> : null}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Saving" : "Update password"}
        </Button>
      </form>
    </AnimateHeight>
  );
}
