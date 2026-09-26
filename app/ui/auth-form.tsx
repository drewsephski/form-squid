"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimateHeight } from "@/components/ui/animate-height";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { continueAfterAuth } from "@/app/lib/continue-after-auth";
import { trackFunnel } from "@/app/lib/analytics";
import { authClient } from "@/lib/auth-client";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
  oauthError?: string | null;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.43Z"
        opacity="0.9"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.89 6.63-2.42l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.58A9.99 9.99 0 0 0 12 22Z"
        opacity="0.75"
      />
      <path
        fill="currentColor"
        d="M6.39 13.91A6.01 6.01 0 0 1 6.08 12c0-.66.11-1.31.31-1.91V7.51H3.06A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.06 4.49l3.33-2.58Z"
        opacity="0.6"
      />
      <path
        fill="currentColor"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.97 14.69 2 12 2 8.09 2 4.71 4.24 3.06 7.51l3.33 2.58C7.18 7.72 9.39 5.96 12 5.96Z"
        opacity="0.8"
      />
    </svg>
  );
}

export function AuthForm({ mode, oauthError }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(oauthError ? "Google sign-in failed. Try again." : "");
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
    if (mode === "sign-up") {
      trackFunnel("signup_completed", { page: "/sign-up", authenticated: true });
    }

    await continueAfterAuth({
      page: mode === "sign-up" ? "/sign-up" : "/sign-in",
      router,
      onError: (message) => {
        setPending(false);
        setError(message);
      },
    });
  }

  async function handleGoogleSignIn() {
    setPending(true);
    setError("");
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/auth/continue",
      errorCallbackURL: mode === "sign-up" ? "/sign-up" : "/sign-in",
    });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? "Could not start Google sign-in.");
    }
  }

  return (
    <AnimateHeight>
      <div className="mx-auto grid w-full max-w-sm gap-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          aria-label={mode === "sign-up" ? "Continue with Google" : "Sign in with Google"}
          onClick={() => {
            void handleGoogleSignIn();
          }}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          {mode === "sign-up" ? (
            <div className="grid gap-2 text-left">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
          ) : null}
          <div className="grid gap-2 text-left">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="grid gap-2 text-left">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="text-left text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
        </form>
      </div>
    </AnimateHeight>
  );
}
