"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

function redactAnalyticsEvent(event: BeforeSendEvent) {
  try {
    const url = new URL(event.url);
    url.pathname = url.pathname.replace(/\/forms\/[^/]+/g, "/forms/[id]");
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}

export function FunnelAnalytics() {
  return <Analytics beforeSend={redactAnalyticsEvent} />;
}
