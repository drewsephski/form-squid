import Link from "next/link";
import { AuthForm } from "@/app/ui/auth-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="my-auto space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-medium">Create your account</h1>
          <p className="text-muted-foreground">Your generated form is saved in this browser until you continue.</p>
        </div>
        <AuthForm mode="sign-up" />
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
