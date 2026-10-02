"use client";

import { saveForm } from "./actions/forms-write";
import { trackFunnel } from "./analytics";
import { pendingSpecKey } from "./definitions";
import { clearBrowserDraft } from "./browser-draft";

export async function continueAfterAuth(options: {
  page: string;
  router: { push: (href: string) => void };
  onError: (message: string) => void;
}): Promise<void> {
  try {
    const pendingSpec = window.localStorage.getItem(pendingSpecKey);
    if (!pendingSpec) {
      options.router.push("/forms");
      return;
    }
    const saved = await saveForm(JSON.parse(pendingSpec));
    trackFunnel("form_created", { page: options.page, authenticated: true });
    clearBrowserDraft();
    options.router.push(`/forms/${saved.id}`);
  } catch (caught) {
    options.onError(caught instanceof Error ? caught.message : "Could not save the form.");
  }
}
