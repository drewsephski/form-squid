import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/lib/seo";
import { LegalDoc } from "@/app/ui/legal-doc";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy | FormSquid",
  description:
    "How FormSquid collects, uses, stores, and shares personal data for accounts, Google sign-in, hosted forms, submissions, uploads, and analytics.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      description="This policy explains what information FormSquid collects, why we collect it, how we use it, and the choices you have."
      updated="September 25, 2026"
      page="/privacy"
    >
      <section className="space-y-3">
        <h2>1. Who we are</h2>
        <p>
          FormSquid (&quot;FormSquid,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is an AI-assisted form builder
          available at{" "}
          <Link href="https://formsquid.com">https://formsquid.com</Link>. We help users generate, host, publish,
          and manage forms; collect submissions; export form source code; and optionally deliver notifications and
          webhooks.
        </p>
        <p>
          For privacy questions, contact us at{" "}
          <a href="mailto:privacy@formsquid.com">privacy@formsquid.com</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Scope</h2>
        <p>This Privacy Policy applies to:</p>
        <ul>
          <li>Account holders who create and manage forms on FormSquid</li>
          <li>Visitors who browse the FormSquid website</li>
          <li>People who submit responses to forms hosted by FormSquid on behalf of an account holder</li>
        </ul>
        <p>
          When someone fills out a form you publish, you are typically the controller of that submission data. We
          process that data as a service provider to host, store, and deliver it according to your configuration and
          this policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Information we collect</h2>

        <h3>3.1 Account and authentication information</h3>
        <p>When you create or sign in to an account, we collect:</p>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>Password (stored only as a secure hash if you use email/password sign-in)</li>
          <li>Profile image URL, when provided by an identity provider</li>
          <li>Account creation and update timestamps</li>
        </ul>
        <p>
          If you sign in with Google, we receive basic profile information from Google that you authorize during the
          OAuth consent flow. This typically includes your Google account identifier, name, email address, and profile
          image. We use this information only to create and maintain your FormSquid account, authenticate you, and
          (when enabled) link a Google account to an existing FormSquid account with the same email address. We do not
          use Google user data for advertising, and we do not sell Google user data.
        </p>

        <h3>3.2 Form configuration and content you create</h3>
        <p>When you use FormSquid as an account holder, we store:</p>
        <ul>
          <li>Form titles, field definitions, copy, appearance settings, and draft/published versions</li>
          <li>Form slugs and registry keys used for hosted URLs and source export</li>
          <li>Optional notification email addresses you configure for a form</li>
          <li>Optional webhook destination settings you configure for a form</li>
          <li>Prompts and related inputs you provide to generate or edit forms with AI</li>
        </ul>

        <h3>3.3 Form submissions and uploads</h3>
        <p>When a respondent submits a form you host on FormSquid, we collect:</p>
        <ul>
          <li>The answers and files the respondent provides in the form fields you configured</li>
          <li>Submission timestamps and technical metadata needed to store, rate-limit, and deliver the submission</li>
          <li>Hashed request identifiers used for abuse prevention and rate limiting (not used as a public profile)</li>
        </ul>
        <p>
          File uploads attached to form submissions are stored in object storage associated with your form so you can
          review and download them from your inbox.
        </p>

        <h3>3.4 Technical and usage information</h3>
        <p>We automatically collect limited technical data such as:</p>
        <ul>
          <li>IP address and user agent associated with authenticated sessions</li>
          <li>Approximate usage events (for example, page views and product funnel events)</li>
          <li>Diagnostic logs needed to operate, secure, and debug the service</li>
        </ul>
        <p>
          We use Vercel Analytics for product and traffic measurement. Analytics events are processed in a way that
          avoids including unnecessary query strings and redacts sensitive path segments where practical.
        </p>
      </section>

      <section className="space-y-3">
        <h2>4. How we use information</h2>
        <p>We use the information described above to:</p>
        <ul>
          <li>Provide, operate, and improve FormSquid</li>
          <li>Authenticate users and maintain account security</li>
          <li>Generate, edit, publish, and host forms</li>
          <li>Store submissions and file uploads for account holders</li>
          <li>Send optional email notifications related to authentication or form submissions</li>
          <li>Deliver optional signed webhooks you configure</li>
          <li>Prevent abuse, spam, fraud, and rate-limit violations</li>
          <li>Analyze product usage and improve reliability and performance</li>
          <li>Comply with legal obligations and enforce our Terms of Service</li>
        </ul>
        <p>
          AI features may send prompts and relevant form context to third-party model providers so we can generate or
          edit form content. Do not include secrets or sensitive personal data in prompts unless necessary for your use
          case.
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. How we share information</h2>
        <p>
          We do not sell personal information. We share information only as needed to operate the service or as
          required by law, including with:
        </p>
        <ul>
          <li>
            <strong>Infrastructure and database providers</strong> that host FormSquid and store account, form, and
            submission data (including Neon Postgres and our application hosting provider)
          </li>
          <li>
            <strong>Object storage providers</strong> that store uploaded files attached to submissions
          </li>
          <li>
            <strong>Email delivery providers</strong> (such as Resend) when we send password-reset or optional
            submission notification emails
          </li>
          <li>
            <strong>Google</strong>, when you choose Google sign-in, to authenticate your account through Google&apos;s
            OAuth services
          </li>
          <li>
            <strong>AI model providers</strong> used to power form generation and editing features
          </li>
          <li>
            <strong>Analytics providers</strong> used for product and website analytics
          </li>
          <li>
            <strong>Destinations you configure</strong>, such as webhook endpoints or notification email addresses you
            set on a form
          </li>
          <li>
            <strong>Professional advisors or authorities</strong> when reasonably necessary to comply with law, protect
            rights and safety, or respond to lawful requests
          </li>
        </ul>
        <p>
          If FormSquid is involved in a merger, acquisition, financing, or sale of assets, personal information may be
          transferred as part of that transaction, subject to appropriate confidentiality and continuity protections.
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. Cookies and session technology</h2>
        <p>
          FormSquid uses cookies and similar technologies that are necessary to keep you signed in, protect sessions,
          and operate the service. Session records may include IP address and user agent information for security and
          account integrity. We do not use third-party advertising cookies to track you across unrelated sites for ad
          targeting.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Data retention</h2>
        <p>
          We retain account information for as long as your account remains active. Form definitions, submissions, and
          uploads are retained while associated with an active account and form, unless deleted earlier by you or as
          part of account/form deletion workflows.
        </p>
        <p>
          We may retain limited logs, backups, or security records for a longer period when needed for abuse
          prevention, dispute resolution, legal compliance, or reliable service operation. When retention is no longer
          necessary, we delete or de-identify the data.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Security</h2>
        <p>
          We use administrative, technical, and organizational measures designed to protect personal information,
          including encrypted transport (HTTPS), hashed passwords for email/password accounts, access controls, and
          abuse protections such as rate limiting. No method of transmission or storage is completely secure, and we
          cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Your choices and rights</h2>
        <p>Depending on your location and applicable law, you may have rights to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Correct inaccurate account information</li>
          <li>Delete your account or request deletion of personal information</li>
          <li>Export or obtain a copy of certain information you provided</li>
          <li>Object to or restrict certain processing, where applicable</li>
        </ul>
        <p>
          Account holders can manage much of their data directly in the product (for example, reviewing submissions,
          deleting forms, or updating account settings). To make a privacy request, email{" "}
          <a href="mailto:privacy@formsquid.com">privacy@formsquid.com</a>. We may need to verify your identity before
          completing the request.
        </p>
        <p>
          If you submitted information through a form owned by another FormSquid customer, contact that form owner
          first. We can assist the account holder with technical deletion or access where appropriate.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. International processing</h2>
        <p>
          FormSquid is operated using cloud infrastructure that may process data in the United States and other
          countries where our providers operate. If you access the service from outside those locations, your
          information may be transferred to and processed in those countries.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Children&apos;s privacy</h2>
        <p>
          FormSquid is not directed to children under 13 (or the equivalent minimum age in your jurisdiction), and we
          do not knowingly collect personal information from children. If you believe a child has provided personal
          information to us, contact <a href="mailto:privacy@formsquid.com">privacy@formsquid.com</a> and we will take
          appropriate steps to delete it.
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Third-party services and links</h2>
        <p>
          The service integrates with third-party providers for authentication, hosting, storage, email, analytics, and
          AI features. Those providers process information according to their own privacy policies in addition to our
          instructions. FormSquid pages may also link to external sites we do not control.
        </p>
      </section>

      <section className="space-y-3">
        <h2>13. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the &quot;Last updated&quot;
          date above and, when changes are material, take additional steps that are reasonable under the circumstances,
          such as posting a notice on the site or contacting account holders.
        </p>
      </section>

      <section className="space-y-3">
        <h2>14. Contact</h2>
        <p>
          Questions about this Privacy Policy or FormSquid&apos;s data practices can be sent to{" "}
          <a href="mailto:privacy@formsquid.com">privacy@formsquid.com</a>.
        </p>
        <p>
          Related: <Link href="/terms">Terms of Service</Link>
        </p>
      </section>
    </LegalDoc>
  );
}
