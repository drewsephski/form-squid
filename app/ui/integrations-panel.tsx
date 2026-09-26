"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CodeBlock } from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackFunnel } from "@/app/lib/analytics";
import {
  getWebhook,
  rotateWebhookSecret,
  saveWebhook,
  sendTestWebhook,
  retryFailedDelivery,
} from "@/app/lib/actions/webhooks";
import { formatRelativeAgo } from "@/lib/formatter";

export type WebhookPanelState = {
  id: string;
  url: string;
  enabled: boolean;
  hasSecret: true;
  secretMasked: string;
  createdAt: string;
  updatedAt: string;
  deliveries: Array<{
    id: string;
    submissionId: string | null;
    attempt: number;
    status: string;
    responseStatus: number | null;
    error: string | null;
    createdAt: string;
    deliveredAt: string | null;
  }>;
};

const verifySnippet = `import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, header, rawBody) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => part.trim().split("="))
  );
  const timestamp = parts.t;
  const expected = createHmac("sha256", secret)
    .update(\`\${timestamp}.\${rawBody}\`, "utf8")
    .digest("hex");
  const left = Buffer.from(parts.v1, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}`;

interface IntegrationsPanelProps {
  formId: string;
  initialWebhook: WebhookPanelState | null;
  onWebhookChange?: (webhook: WebhookPanelState | null) => void;
}

export function IntegrationsPanel({ formId, initialWebhook, onWebhookChange }: IntegrationsPanelProps) {
  const [webhook, setWebhook] = useState<WebhookPanelState | null>(initialWebhook);
  const [url, setUrl] = useState(initialWebhook?.url ?? "");
  const [enabled, setEnabled] = useState(initialWebhook?.enabled ?? true);
  /** One-time plaintext secret from create/rotate only — never loaded from normal reads. */
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [secretMasked, setSecretMasked] = useState(initialWebhook?.secretMasked ?? "fs_whsec_********");
  const [pending, setPending] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);

  async function refresh(preserveRevealedSecret = false) {
    const next = await getWebhook(formId);
    setWebhook(next);
    onWebhookChange?.(next);
    if (next) {
      setUrl(next.url);
      setEnabled(next.enabled);
      setSecretMasked(next.secretMasked);
    } else {
      setSecretMasked("fs_whsec_********");
    }
    if (!preserveRevealedSecret) {
      setRevealedSecret(null);
    }
  }

  async function handleSave() {
    setPending(true);
    try {
      const result = await saveWebhook(formId, url, enabled);
      if (result.secret) {
        setRevealedSecret(result.secret);
      }
      setSecretMasked(result.secretMasked);
      if (result.created) {
        trackFunnel("webhook_connected", { page: "/forms", authenticated: true });
      }
      toast.success(result.created ? "Webhook saved." : "Webhook updated.");
      await refresh(Boolean(result.secret));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save webhook.");
    } finally {
      setPending(false);
    }
  }

  async function handleCopySecret() {
    if (!revealedSecret) {
      toast.error("Signing secrets are shown once. Rotate the secret if you need a new one.");
      return;
    }
    try {
      await navigator.clipboard.writeText(revealedSecret);
      toast.success("Signing secret copied");
    } catch {
      toast.error("Could not copy the secret.");
    }
  }

  async function handleRotate() {
    setPending(true);
    try {
      const result = await rotateWebhookSecret(formId);
      setRevealedSecret(result.secret);
      setSecretMasked(result.secretMasked);
      setRotateOpen(false);
      toast.success("Signing secret rotated.");
      await refresh(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not rotate secret.");
    } finally {
      setPending(false);
    }
  }

  async function handleSendTest() {
    setPending(true);
    setTestResult("");
    try {
      const result = await sendTestWebhook(formId);
      trackFunnel("webhook_tested", { page: "/forms", authenticated: true });
      if (result.ok) {
        setTestResult(`Delivered · HTTP ${result.responseStatus ?? "2xx"}`);
        toast.success("Test webhook delivered.");
      } else {
        setTestResult(result.error ?? `Failed · HTTP ${result.responseStatus ?? "—"}`);
        toast.error(result.error ?? "Test webhook failed.");
      }
      await refresh(Boolean(revealedSecret));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not send test.";
      setTestResult(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function handleRetry(deliveryId: string) {
    setPending(true);
    try {
      const result = await retryFailedDelivery(formId, deliveryId);
      if (result.ok) {
        toast.success("Delivery retried.");
      } else {
        toast.error(result.error ?? "Retry failed.");
      }
      await refresh(Boolean(revealedSecret));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not retry delivery.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Webhook</h2>
        {!webhook ? (
          <p className="text-sm text-muted-foreground">Send every new response to your API.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            FormSquid POSTs signed <code className="font-mono text-xs">submission.created</code> events to this URL.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">URL</Label>
          <Input
            id="webhook-url"
            aria-label="Webhook URL"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/api/forms"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(value) => setEnabled(value === true)}
            aria-label="Enabled"
          />
          Enabled
        </label>
        <Button type="button" onClick={() => void handleSave()} disabled={pending}>
          Save webhook
        </Button>
      </div>

      {webhook || revealedSecret ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Signing secret</p>
            <p className="text-sm text-muted-foreground">
              Signing secrets are shown once. Rotate the secret if you need a new one.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs">
                {revealedSecret ?? secretMasked}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopySecret()}
                disabled={!revealedSecret}
                aria-label="Copy signing secret"
              >
                Copy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !webhook}
                onClick={() => setRotateOpen(true)}
              >
                Rotate secret
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void handleSendTest()} disabled={pending || !webhook}>
              Send test
            </Button>
            {testResult ? <p className="text-sm text-muted-foreground">{testResult}</p> : null}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Verify signatures</p>
            <CodeBlock code={verifySnippet} language="ts" filename="verify.ts" maxHeight="14rem" />
          </div>
        </div>
      ) : null}

      {webhook ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recent deliveries</h3>
          {webhook.deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {webhook.deliveries.map((delivery) => (
                <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="capitalize">{delivery.status}</p>
                    <p className="text-muted-foreground">
                      {delivery.responseStatus ?? "—"} · {formatRelativeAgo(delivery.createdAt)}
                      {delivery.error ? ` · ${delivery.error}` : ""}
                    </p>
                  </div>
                  {delivery.status === "failed" && delivery.submissionId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => void handleRetry(delivery.id)}
                    >
                      Retry
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate signing secret?</AlertDialogTitle>
            <AlertDialogDescription>
              The current secret stops working immediately. Update your endpoint before rotating if you rely on
              verification. Signing secrets are shown once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" onClick={() => void handleRotate()} disabled={pending}>
              Rotate
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
