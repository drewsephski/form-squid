"use client";

import { saveForm } from "@/app/lib/actions/forms-write";
import { trackFunnel } from "@/app/lib/analytics";
import { pendingSpecKey } from "@/app/lib/definitions";

export async function continueAfterAuth(options: {
  page: string;
  router: { push: (href: string) => void };
  onError: (message: string) => void;
}): Promise<void> {
  const pendingSpec = window.localStorage.getItem(pendingSpecKey);
  if (!pendingSpec) {
    options.router.push("/forms");
    return;
  }

  try {
    const saved = await saveForm(JSON.parse(pendingSpec));
    trackFunnel("form_created", { page: options.page, authenticated: true });
    window.localStorage.removeItem(pendingSpecKey);
    options.router.push(`/forms/${saved.id}`);
  } catch (caught) {
    window.localStorage.removeItem(pendingSpecKey);
    options.onError(caught instanceof Error ? caught.message : "Could not save the form.");
  }
}
