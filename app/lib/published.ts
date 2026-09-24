import { eq } from "drizzle-orm";
import { db } from "@/db";
import { formVersions, forms } from "@/db/schema";
import { formSpecSchema } from "@/app/lib/definitions";

export async function getPublishedForm(slug: string) {
  const [form] = await db.select().from(forms).where(eq(forms.slug, slug));
  if (!form?.currentPublishedVersionId) {
    return null;
  }
  const [version] = await db.select().from(formVersions).where(eq(formVersions.id, form.currentPublishedVersionId));
  if (!version) {
    return null;
  }
  return {
    id: form.id,
    slug: form.slug,
    notifyEmail: form.notifyEmail,
    versionId: version.id,
    spec: formSpecSchema.parse(version.spec),
  };
}

export async function getPublishedByRegistryKey(registryKey: string) {
  const [form] = await db.select().from(forms).where(eq(forms.registryKey, registryKey));
  if (!form?.currentPublishedVersionId) {
    return null;
  }
  const [version] = await db.select().from(formVersions).where(eq(formVersions.id, form.currentPublishedVersionId));
  if (!version) {
    return null;
  }
  return {
    slug: form.slug,
    spec: formSpecSchema.parse(version.spec),
  };
}
