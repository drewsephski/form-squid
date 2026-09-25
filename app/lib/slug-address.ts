export interface FormAddress {
  slug: string;
  draftSlug: string;
}

export function addressAfterDraftSave(current: FormAddress, draftSlug: string): FormAddress {
  return { slug: current.slug, draftSlug };
}

export function addressAfterPublish(draftSlug: string): FormAddress {
  return { slug: draftSlug, draftSlug };
}
