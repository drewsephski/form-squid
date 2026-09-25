import { ResetPasswordForm } from "@/app/ui/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <div className="my-auto space-y-8 text-center">
        <h1 className="font-heading text-4xl font-medium">Reset password</h1>
        <ResetPasswordForm token={token} error={error} />
      </div>
    </main>
  );
}
