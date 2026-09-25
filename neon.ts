import { defineConfig } from "@neon/config/v1";

const functionEnv: Record<string, string> = {};
if (process.env.RESEND_API_KEY) {
  functionEnv.RESEND_API_KEY = process.env.RESEND_API_KEY;
}
if (process.env.RESEND_FROM) {
  functionEnv.RESEND_FROM = process.env.RESEND_FROM;
}
if (process.env.RATE_LIMIT_IP_SALT) {
  functionEnv.RATE_LIMIT_IP_SALT = process.env.RATE_LIMIT_IP_SALT;
}

export default defineConfig({
  buckets: {
    "submission-uploads": {},
  },
  functions: {
    api: {
      name: "FormSquid API",
      source: "./functions/api.ts",
      customDomains: ["api.formsquid.com"],
      ...(Object.keys(functionEnv).length > 0 ? { env: functionEnv } : {}),
    },
    maintenance: {
      name: "Maintenance",
      source: "./functions/maintenance.ts",
    },
  },
  triggers: {
    "purge-generations": {
      type: "schedule",
      function: "maintenance",
      cron: "0 0 * * *",
    },
  },
});
