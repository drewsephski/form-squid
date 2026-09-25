"use client";

import { track } from "@vercel/analytics";

export const funnelEvents = [
  "seo_page_view",
  "source_tab_opened",
  "source_copied",
  "customize_clicked",
  "template_used",
  "generation_started",
  "generation_succeeded",
  "signup_completed",
  "form_created",
  "form_published",
] as const;

export type FunnelEvent = (typeof funnelEvents)[number];

export interface FunnelProperties {
  page?: string;
  templateSlug?: string;
  shadcnSlug?: string;
  authenticated?: boolean;
  referrer?: string;
}

const maxPropertyLength = 180;

export function funnelProperties(input: FunnelProperties) {
  const properties: Record<string, string | boolean> = {};
  for (const key of ["page", "templateSlug", "shadcnSlug", "referrer"] as const) {
    const value = input[key]?.trim();
    if (value) properties[key] = value.slice(0, maxPropertyLength);
  }
  if (input.authenticated !== undefined) properties.authenticated = input.authenticated;
  return properties;
}

export function trackFunnel(event: FunnelEvent, input: FunnelProperties = {}) {
  track(event, funnelProperties(input));
}

export function currentReferrer() {
  if (typeof document === "undefined") return undefined;
  return document.referrer || undefined;
}
