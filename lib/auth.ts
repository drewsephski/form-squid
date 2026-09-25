import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { after } from "next/server";
import { db } from "../db";
import * as schema from "../db/schema";
import { passwordResetEmail, sendAuthEmail } from "../server/mail";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "FormSquid",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      const message = passwordResetEmail(url);
      const delivery = sendAuthEmail({ to: user.email, ...message }).catch((error: unknown) => {
        console.error("password reset email failed", error);
      });
      after(() => delivery);
    },
  },
  trustedOrigins: [origin],
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },
});
