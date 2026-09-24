import Link from "next/link";
import { redirect } from "next/navigation";
import { listForms } from "@/app/lib/actions/forms-read";
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
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-4xl font-medium tracking-tight">My forms</h1>
          <p className="text-muted-foreground">Drafts and published forms.</p>
        </div>
        <Link href="/" className={buttonVariants()}>
          New form
        </Link>
      </div>
      {forms.length === 0 ? (
        <p className="text-muted-foreground">No forms yet.</p>
      ) : (
        <ul className="grid gap-3">
          {forms.map((form) => (
            <li key={form.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{form.title}</p>
                <p className="truncate text-sm text-muted-foreground">{form.host}</p>
                <p className="text-sm text-muted-foreground">
                  {form.published ? "Published" : "Draft"} · {form.responses} {form.responses === 1 ? "response" : "responses"}
                </p>
              </div>
              <Link href={`/forms/${form.id}`} className={buttonVariants({ variant: "outline" })}>
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
