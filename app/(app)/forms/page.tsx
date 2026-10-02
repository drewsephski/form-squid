import Link from "next/link";
import { redirect } from "next/navigation";
import { listForms } from "@/app/lib/actions/forms-read";
import { FormsList } from "@/app/ui/forms-list";
import { buttonVariants } from "@/components/ui/button";

export default async function FormsPage() {
  let forms: Awaited<ReturnType<typeof listForms>>;
  try {
    forms = await listForms();
  } catch {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">My forms</h1>
          <p className="text-muted-foreground">Drafts and published forms.</p>
        </div>
        <Link href="/" data-slot="button" className={buttonVariants()}>
          New form
        </Link>
      </div>
      <FormsList forms={forms} />
    </main>
  );
}
