import { notFound } from "next/navigation";
import { getForm } from "@/app/lib/actions/forms-read";
import { Editor } from "@/app/ui/editor";

export default async function FormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const form = await getForm(formId).catch(() => null);
  if (!form) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col justify-center px-4 py-8">
      <div className="my-auto min-w-0 w-full">
        <Editor form={form} />
      </div>
    </main>
  );
}
