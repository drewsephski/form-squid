import { defineConfig } from "@neon/config/v1";

const resendEnv: Record<string, string> = {};
if (process.env.RESEND_API_KEY) {
  resendEnv.RESEND_API_KEY = process.env.RESEND_API_KEY;
}
if (process.env.RESEND_FROM) {
  resendEnv.RESEND_FROM = process.env.RESEND_FROM;
}

export default defineConfig({
  functions: {
    api: {
      name: "FormSquid API",
      source: "./functions/api.ts",
      customDomains: ["api.formsquid.com"],
      ...(Object.keys(resendEnv).length > 0 ? { env: resendEnv } : {}),
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
