"use server";

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/db";
import { formVersions, forms } from "@/db/schema";
import { formSpecSchema, type FormSpec } from "@/app/lib/definitions";
import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";
import { assertPublicSlug, reservedSlugs } from "@/app/lib/reserved-slugs";
import { addressAfterDraftSave, addressAfterPublish } from "@/app/lib/slug-address";
import { deleteFormWithStorage } from "@/server/delete-lifecycle";

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "form";
}

async function uniqueSlug(title: string, currentId?: string) {
  const base = slugify(title);
  for (let index = 0; index < 40; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    if (reservedSlugs.has(slug)) {
      continue;
    }
    const existing = await db.select({ id: forms.id }).from(forms).where(eq(forms.slug, slug));
    if (!existing[0] || existing[0].id === currentId) {
      return slug;
    }
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function saveForm(input: unknown) {
  const user = await requireUser();
  const spec = formSpecSchema.parse(input);
  const id = randomUUID();
  const slug = await uniqueSlug(spec.title);
  await db.insert(forms).values({
    id,
    userId: user.id,
    slug,
    draftSlug: slug,
    registryKey: randomBytes(24).toString("hex"),
    draftSpec: spec,
  });
  return { id };
}

export async function updateDraft(formId: string, input: unknown, slug: string) {
  const user = await requireUser();
  const current = await requireFormOwner(formId, user.id);
  const spec = formSpecSchema.parse(input);
  const nextDraftSlug = assertPublicSlug(slug);
  const address = addressAfterDraftSave(current, nextDraftSlug);
  await db.update(forms).set({ draftSpec: spec, draftSlug: address.draftSlug, updatedAt: new Date() }).where(eq(forms.id, formId));
}

export async function publishForm(formId: string, input: unknown, slug: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const spec = formSpecSchema.parse(input);
  const nextSlug = assertPublicSlug(slug);
  const versionId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from forms where id = ${formId} for update`);
    const taken = await tx
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.slug, nextSlug), ne(forms.id, formId)));
    if (taken[0]) {
      throw new Error("That address is already taken.");
    }
    const address = addressAfterPublish(nextSlug);
    const versions = await tx
      .select({ versionNumber: formVersions.versionNumber })
      .from(formVersions)
      .where(eq(formVersions.formId, formId))
      .orderBy(desc(formVersions.versionNumber));
    const versionNumber = (versions[0]?.versionNumber ?? 0) + 1;
    await tx.update(forms).set({ draftSpec: spec, slug: address.slug, draftSlug: address.draftSlug, updatedAt: new Date() }).where(eq(forms.id, formId));
    await tx.insert(formVersions).values({
      id: versionId,
      formId,
      versionNumber,
      spec,
    });
    await tx
      .update(forms)
      .set({ currentPublishedVersionId: versionId, updatedAt: new Date() })
      .where(eq(forms.id, formId));
  });

  return { versionId };
}

export async function restoreVersion(formId: string, versionId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const [version] = await db.select().from(formVersions).where(eq(formVersions.id, versionId));
  if (!version || version.formId !== formId) {
    throw new Error("Version not found");
  }
  const spec = formSpecSchema.parse(version.spec);
  await db.update(forms).set({ draftSpec: spec, updatedAt: new Date() }).where(eq(forms.id, formId));
  return spec satisfies FormSpec;
}

export async function unpublishForm(formId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  await db.update(forms).set({ currentPublishedVersionId: null, updatedAt: new Date() }).where(eq(forms.id, formId));
}

export async function duplicateForm(formId: string) {
  const user = await requireUser();
  const form = await requireFormOwner(formId, user.id);
  const spec = formSpecSchema.parse(form.draftSpec);
  const title = `${spec.title} copy`.slice(0, 200);
  const id = randomUUID();
  const slug = await uniqueSlug(title);
  await db.insert(forms).values({
    id,
    userId: user.id,
    slug,
    draftSlug: slug,
    registryKey: randomBytes(24).toString("hex"),
    draftSpec: { ...spec, title },
  });
  return { id };
}

export async function deleteForm(formId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  await deleteFormWithStorage(db, formId);
}

export async function updateNotifyEmail(formId: string, notifyEmail: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const next = notifyEmail.trim();
  if (next && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
    throw new Error("Enter a valid notification email.");
  }
  await db.update(forms).set({ notifyEmail: next || null, updatedAt: new Date() }).where(eq(forms.id, formId));
}
