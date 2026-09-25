import { sql } from "drizzle-orm";
import { parseTriggerDelivery } from "@neon/functions/triggers";
import { db } from "../db/function";
import { purgeStalePendingUploads } from "../server/uploads";

export default {
  async fetch(request: Request): Promise<Response> {
    const parsed = await parseTriggerDelivery(request);
    if (!parsed.ok) {
      const status = parsed.error === "invalid_body" ? 400 : 401;
      return new Response(parsed.error, { status });
    }

    await db.execute(sql`DELETE FROM generation_events WHERE created_at < NOW() - INTERVAL '7 days'`);
    await db.execute(sql`DELETE FROM submission_rate_buckets WHERE bucket_start < NOW() - INTERVAL '1 hour'`);
    await purgeStalePendingUploads(db);
    return new Response(null, { status: 204 });
  },
};
