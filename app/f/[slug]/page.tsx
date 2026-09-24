import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedForm } from "@/app/lib/published";
import { submitUrlFor } from "@/app/lib/origin";
import { FormView } from "@/app/ui/form-view";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function HostedFormPage({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const form = await getPublishedForm(slug);
  if (!form) {
    notFound();
  }

  return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-8">
        <div className="my-auto">
          <FormView spec={form.spec} submitUrl={submitUrlFor(form.slug)} />
        </div>
      </main>
  );
}
