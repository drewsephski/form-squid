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
    return <p className="text-muted-foreground">No forms yet.</p>;
  }

  return (
    <>
      <ul className="grid gap-3">
        {forms.map((form) => (
          <li key={form.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {form.preview ? (
                <div className="hidden w-40 shrink-0 sm:block">
                  <FormMiniPreview spec={form.preview} />
                </div>
              ) : null}
              <div className="min-w-0 space-y-1">
              <p className="truncate font-medium">{form.title}</p>
              <p className="text-sm">
                <span className={`mr-2 inline-block size-2 rounded-full align-middle ${form.published ? "bg-primary" : "bg-muted-foreground"}`} aria-hidden="true" />
                {form.published ? "Published" : "Draft"}
              </p>
              <p className="truncate font-mono text-sm text-muted-foreground">{form.host}</p>
              <p className="text-sm text-muted-foreground">
                {form.responses} {form.responses === 1 ? "response" : "responses"} · {formatUpdated(form.updatedAt)}
              </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {form.published ? (
                <a href={liveHref(form.slug)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                  Open
                </a>
              ) : null}
              <Link href={`/forms/${form.id}`} className={buttonVariants({ variant: "outline" })}>
                Edit
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={`${form.title} actions`} className="rounded-md px-2 py-1 text-sm hover:bg-muted" disabled={pendingId === form.id}>
                  •••
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleDuplicate(form.id)}>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem disabled={!form.published} onClick={() => void handleCopy(form.slug)}>
                    Copy link
                  </DropdownMenuItem>
                  {form.published ? <DropdownMenuItem onClick={() => void handleUnpublish(form.id)}>Unpublish</DropdownMenuItem> : null}
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(form.id)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.title ?? "this form"}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the form, its published link, and its submissions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={pendingId === deleteId}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
