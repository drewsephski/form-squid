import Link from "next/link";
import { AuthForm } from "@/app/ui/auth-form";

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="my-auto space-y-8 text-center">
        <h1 className="font-heading text-4xl font-medium">Sign in</h1>
        <AuthForm mode="sign-in" />
        <p className="text-sm text-muted-foreground">
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
        <p className="text-sm text-muted-foreground">
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
