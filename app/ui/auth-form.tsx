"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveForm } from "@/app/lib/actions/forms-write";
import { pendingSpecKey } from "@/app/lib/definitions";
import { authClient } from "@/lib/auth-client";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setPending(true);
    setError("");
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? "Could not sign in.");
      return;
    }

    const pendingSpec = window.localStorage.getItem(pendingSpecKey);
    if (!pendingSpec) {
      router.push("/");
      return;
    }

    try {
      const saved = await saveForm(JSON.parse(pendingSpec));
      window.localStorage.removeItem(pendingSpecKey);
      router.push(`/forms/${saved.id}`);
    } catch (caught) {
      window.localStorage.removeItem(pendingSpecKey);
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not save the form.");
    }
  }

  return (
    <form
      className="mx-auto grid w-full max-w-sm gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      {mode === "sign-up" ? (
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
