import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { after } from "next/server";
import { db } from "../db";
import * as schema from "../db/schema";
import { passwordResetEmail, sendAuthEmail } from "../server/mail";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? origin;

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
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Email verification is off for password sign-up; allow linking the same address to Google.
      requireLocalEmailVerified: false,
    },
  },
  trustedOrigins: [...new Set([origin, appOrigin, "http://localhost:3000"])],
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },
});
