"use client";

import { useEffect } from "react";
import { currentReferrer, trackFunnel, type FunnelProperties } from "@/app/lib/analytics";

export function SeoPageView({ page, templateSlug, shadcnSlug }: FunnelProperties) {
  useEffect(() => {
    trackFunnel("seo_page_view", {
      page,
      templateSlug,
      shadcnSlug,
      referrer: currentReferrer(),
    });
  }, [page, templateSlug, shadcnSlug]);

  return null;
}
