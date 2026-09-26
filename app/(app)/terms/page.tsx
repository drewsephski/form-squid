import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/lib/seo";
import { LegalDoc } from "@/app/ui/legal-doc";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service | FormSquid",
  description:
    "Terms governing use of FormSquid, including accounts, hosted forms, submissions, AI features, acceptable use, and liability.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      description="These terms govern your access to and use of FormSquid. By using the service, you agree to them."
      updated="September 25, 2026"
      page="/terms"
    >
      <section className="space-y-3">
        <h2>1. Agreement</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) are an agreement between you and FormSquid regarding the website
          and services available at <Link href="https://formsquid.com">https://formsquid.com</Link> (the
          &quot;Service&quot;). By creating an account, signing in, publishing a form, or otherwise using the Service,
          you agree to these Terms and our <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          If you use FormSquid on behalf of an organization, you represent that you have authority to bind that
          organization, and &quot;you&quot; includes that organization.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. The Service</h2>
        <p>FormSquid provides tools to:</p>
        <ul>
          <li>Generate and edit forms with AI assistance</li>
          <li>Publish and host forms</li>
          <li>Collect, store, and review submissions and uploads</li>
          <li>Export form source for use with shadcn/ui and related tooling</li>
          <li>Optionally send email notifications and signed webhooks</li>
        </ul>
        <p>
          Features may change over time. We may add, modify, or discontinue functionality, including beta or
          experimental features, with or without notice.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Accounts</h2>
        <p>
          You must provide accurate account information and keep your credentials secure. You are responsible for
          activity under your account. Notify us promptly if you suspect unauthorized access.
        </p>
        <p>
          You may sign in with email and password or with supported social providers such as Google. If you connect a
          third-party identity provider, you authorize us to receive the account information needed to authenticate you.
        </p>
        <p>We may suspend or terminate accounts that violate these Terms or pose a security or abuse risk.</p>
      </section>

      <section className="space-y-3">
        <h2>4. Your content and form submissions</h2>
        <p>
          You retain ownership of the prompts, form designs, copy, configuration, and other content you submit to the
          Service (&quot;Customer Content&quot;). You also remain responsible for the data collected through forms you
          publish (&quot;Submission Data&quot;).
        </p>
        <p>You grant FormSquid a limited license to host, process, transmit, display, and otherwise use Customer Content and Submission Data only as needed to provide and secure the Service, including:</p>
        <ul>
          <li>Storing drafts, published versions, submissions, and uploads</li>
          <li>Generating or editing forms when you use AI features</li>
          <li>Sending notifications or webhooks you configure</li>
          <li>Protecting against abuse and maintaining service reliability</li>
        </ul>
        <p>
          You represent that you have all rights and consents needed to collect, store, and process Submission Data
          through your forms, and that your use of FormSquid complies with applicable privacy, consumer, employment, and
          marketing laws.
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. AI features</h2>
        <p>
          AI generation and editing features may send prompts and related form context to third-party model providers.
          AI output may be inaccurate, incomplete, or unsuitable for your use case. You are responsible for reviewing
          generated forms before publishing them and for any decisions you make based on AI output.
        </p>
        <p>Do not submit confidential secrets, regulated health data, or other sensitive information to AI features unless you accept the associated risk and have a lawful basis to do so.</p>
      </section>

      <section className="space-y-3">
        <h2>6. Acceptable use</h2>
        <p>You agree not to use FormSquid to:</p>
        <ul>
          <li>Violate any law or third-party right</li>
          <li>Collect or process personal data without a lawful basis and required notices/consents</li>
          <li>Send spam, phishing, malware, or deceptive content</li>
          <li>Abuse, overload, scrape, or interfere with the Service or its infrastructure</li>
          <li>Attempt to bypass rate limits, authentication, or security controls</li>
          <li>Upload unlawful, harmful, or infringing files</li>
          <li>Misrepresent your identity or affiliation</li>
          <li>Use the Service to build a competing product through unauthorized access or reverse engineering beyond what applicable law permits</li>
        </ul>
        <p>We may investigate suspected abuse and remove content, disable forms, or restrict access as reasonably necessary.</p>
      </section>

      <section className="space-y-3">
        <h2>7. Webhooks, email, and integrations</h2>
        <p>
          If you configure webhooks, notification emails, or other integrations, you are responsible for the security
          and lawfulness of those destinations and for any data they receive. You must only send Submission Data to
          systems you control or are authorized to use.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Intellectual property</h2>
        <p>
          FormSquid, including its branding, software, documentation, and site design, is owned by FormSquid or its
          licensors. Except for the limited rights needed to use the Service and any source you export for your own
          forms, these Terms do not grant you ownership of FormSquid intellectual property.
        </p>
        <p>
          Exported form source is provided so you can use and adapt it in your own projects, subject to any third-party
          license terms that apply to included libraries or components (for example, shadcn/ui and related open-source
          dependencies).
        </p>
      </section>

      <section className="space-y-3">
        <h2>9. Third-party services</h2>
        <p>
          The Service depends on third-party providers for hosting, databases, authentication, storage, email,
          analytics, and AI. Your use of those providers through FormSquid may be subject to their terms and privacy
          policies. FormSquid is not responsible for third-party services we do not control.
        </p>
      </section>

      <section className="space-y-3">
        <h2>10. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY
          LAW, FORMSQUID DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
          SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
        </p>
      </section>

      <section className="space-y-3">
        <h2>11. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, FORMSQUID AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS WILL NOT
          BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF
          PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, FORMSQUID&apos;S TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR
          RELATED TO THE SERVICE IS LIMITED TO THE GREATER OF (A) THE AMOUNTS YOU PAID TO FORMSQUID FOR THE SERVICE IN
          THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US $100).
        </p>
      </section>

      <section className="space-y-3">
        <h2>12. Indemnification</h2>
        <p>
          You will defend, indemnify, and hold harmless FormSquid from and against claims, losses, and expenses
          (including reasonable attorneys&apos; fees) arising out of Customer Content, Submission Data, your forms, your
          integrations, or your violation of these Terms or applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>13. Suspension and termination</h2>
        <p>
          You may stop using FormSquid at any time and may request account deletion. We may suspend or terminate access
          if you violate these Terms, if required by law, or if continued operation creates risk to the Service or other
          users. Provisions that by their nature should survive termination will survive, including ownership,
          disclaimers, limitations of liability, and indemnification.
        </p>
      </section>

      <section className="space-y-3">
        <h2>14. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. When we do, we will revise the &quot;Last updated&quot; date
          above. Continued use of the Service after changes become effective constitutes acceptance of the updated
          Terms, except where applicable law requires a different process.
        </p>
      </section>

      <section className="space-y-3">
        <h2>15. Governing law</h2>
        <p>
          These Terms are governed by the laws of the United States and the State of Delaware, excluding conflict-of-law
          rules, unless mandatory local law in your place of residence requires otherwise. Courts located in Delaware
          will have exclusive jurisdiction over disputes arising from these Terms, except where prohibited by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2>16. Contact</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:privacy@formsquid.com">privacy@formsquid.com</a>.
        </p>
        <p>
          Related: <Link href="/privacy">Privacy Policy</Link>
        </p>
      </section>
    </LegalDoc>
  );
}
