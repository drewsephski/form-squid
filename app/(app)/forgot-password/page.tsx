import { ForgotPasswordForm } from "@/app/ui/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="my-auto space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-medium">Forgot password</h1>
          <p className="text-muted-foreground">We will email you a link to choose a new one.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
