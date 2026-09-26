"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteForm, duplicateForm, unpublishForm } from "@/app/lib/actions/forms-write";
import type { FormSpec } from "@/app/lib/definitions";
import { hostedUrl } from "@/app/lib/origin";
import { FormMiniPreview } from "@/app/ui/form-mini-preview";
import { Logo } from "@/app/ui/logo";
import { formatUpdated } from "@/lib/formatter";

interface FormSummary {
  id: string;
  title: string;
  preview: FormSpec | null;
  slug: string;
  host: string;
  published: boolean;
  responses: number;
  updatedAt: string;
}

function liveHref(slug: string) {
  if (typeof window === "undefined") {
    return hostedUrl(slug);
  }
  return hostedUrl(slug, window.location);
}

const examplePrompts = [
  "Client intake for a design studio",
  "Event RSVP with dietary needs",
  "Job application with resume upload",
];

export function FormsList({ forms }: { forms: FormSummary[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const deleting = forms.find((form) => form.id === deleteId);

  async function handleCopy(slug: string) {
    try {
      await navigator.clipboard.writeText(liveHref(slug));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  async function handleDuplicate(formId: string) {
    setPendingId(formId);
    try {
      const copy = await duplicateForm(formId);
      router.push(`/forms/${copy.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate the form.");
      setPendingId("");
    }
  }

  async function handleUnpublish(formId: string) {
    setPendingId(formId);
    try {
      await unpublishForm(formId);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unpublish the form.");
    } finally {
      setPendingId("");
    }
  }

  async function handleDelete() {
    if (!deleteId) {
      return;
    }
    setPendingId(deleteId);
    try {
      await deleteForm(deleteId);
      setDeleteId("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the form.");
    } finally {
      setPendingId("");
    }
  }

  if (forms.length === 0) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col items-center rounded-xl border px-6 py-12 text-center">
        <Logo className="mb-6 h-7" />
        <h2 className="font-heading text-2xl font-medium tracking-tight">Create your first form</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe what you need and FormSquid will generate the hosted form and source code.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/" className={buttonVariants()}>
            Generate a form
          </Link>
          <Link href="/templates" className={buttonVariants({ variant: "outline" })}>
            Browse templates
          </Link>
        </div>
        <ul className="mt-8 space-y-1.5 text-xs text-muted-foreground">
          {examplePrompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <ul className="grid gap-3">
        {forms.map((form) => (
          <li key={form.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {form.preview ? (
                <Link
                  href={`/forms/${form.id}`}
                  className="hidden w-40 shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:block"
                  aria-label={`Edit ${form.title}`}
                >
                  <FormMiniPreview spec={form.preview} previewId={form.id} size="thumb" />
                </Link>
              ) : null}
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/forms/${form.id}`}
                  className="block truncate font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {form.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  <span
                    className={`mr-2 inline-block size-1.5 rounded-full align-middle ${form.published ? "bg-foreground" : "bg-muted-foreground/60"}`}
                    aria-hidden="true"
                  />
                  <span className={form.published ? "text-foreground" : ""}>
                    {form.published ? "Published" : "Draft"}
                  </span>
                </p>
                <p className="truncate font-mono text-sm text-muted-foreground">{form.host}</p>
                <p className="text-sm text-muted-foreground">
                  {form.responses} {form.responses === 1 ? "response" : "responses"} · {formatUpdated(form.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {form.published ? (
                <a
                  href={liveHref(form.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Open
                </a>
              ) : null}
              <Link href={`/forms/${form.id}`} className={buttonVariants({ variant: "outline" })}>
                Edit
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${form.title} actions`}
                  className="rounded-md px-2 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={pendingId === form.id}
                >
                  •••
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleDuplicate(form.id)}>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem disabled={!form.published} onClick={() => void handleCopy(form.slug)}>
                    Copy link
                  </DropdownMenuItem>
                  {form.published ? (
                    <DropdownMenuItem onClick={() => void handleUnpublish(form.id)}>Unpublish</DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(form.id)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.title ?? "this form"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the form, its published link, and its submissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={pendingId === deleteId}
            >
              {pendingId === deleteId ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
