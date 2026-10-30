import "server-only";

import { randomUUID } from "node:crypto";
import type { ServerClient } from "postmark";

import { env } from "@/lib/env/server";
import {
  assertPreviewAllowedOperation,
  assertPreviewBlobToken,
  assertPreviewBlobUrl,
  assertPreviewIsolation,
  assertPreviewStorageKey,
  isSyntheticEmail
} from "@/lib/preview/guard";

export type TransactionalEmailDelivery =
  | { status: "sent"; provider: "postmark" }
  | { status: "captured"; provider: "capture"; captureId: string };

let postmarkClient: ServerClient | null = null;

export function getPostmarkClient() {
  assertPreviewAllowedOperation("mail:postmark");
  if (!postmarkClient) {
    const { ServerClient: PostmarkServerClient } = require("postmark") as typeof import("postmark");
    postmarkClient = new PostmarkServerClient(env.POSTMARK_SERVER_TOKEN);
  }

  return postmarkClient;
}

export function getDefaultEmailEnvelope() {
  return {
    from: env.POSTMARK_FROM_EMAIL,
    replyTo: env.POSTMARK_REPLY_TO_EMAIL
  };
}

export async function sendTransactionalEmail(input: {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody: string;
}): Promise<TransactionalEmailDelivery> {
  const previewContext = assertPreviewIsolation();
  if (previewContext) {
    assertPreviewAllowedOperation("mail:capture");
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    if (
      recipients.length === 0 ||
      [...recipients, env.POSTMARK_FROM_EMAIL, env.POSTMARK_REPLY_TO_EMAIL]
        .some((recipient) => !isSyntheticEmail(recipient))
    ) {
      throw new Error("Preview capture requires synthetic .invalid recipients.");
    }
    const captureId = randomUUID();
    const key = `preview-mail/${captureId}.json`;
    const artifact = JSON.stringify({
      deliveryMode: "capture",
      captureId,
      capturedAt: new Date().toISOString(),
      from: env.POSTMARK_FROM_EMAIL,
      replyTo: env.POSTMARK_REPLY_TO_EMAIL,
      to: recipients,
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody
    });
    if (Buffer.byteLength(artifact, "utf8") > 256 * 1024) {
      throw new Error("Preview capture exceeds the synthetic artifact limit.");
    }
    assertPreviewStorageKey(key);
    assertPreviewBlobToken(env.BLOB_READ_WRITE_TOKEN);
    const { put } = await import("@vercel/blob");
    const blob = await put(key, artifact, {
      access: "private",
      token: env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/json",
      addRandomSuffix: false
    });
    assertPreviewBlobUrl(blob.url, key);
    return { status: "captured", provider: "capture", captureId };
  }
  const envelope = getDefaultEmailEnvelope();

  const acceptance = await getPostmarkClient().sendEmail({
    From: envelope.from,
    ReplyTo: envelope.replyTo,
    To: Array.isArray(input.to) ? input.to.join(",") : input.to,
    Subject: input.subject,
    HtmlBody: input.htmlBody,
    TextBody: input.textBody
  });
  if (acceptance?.ErrorCode !== 0 || typeof acceptance.MessageID !== "string" || !acceptance.MessageID.trim()) {
    throw new Error("Email provider acceptance was not confirmed.");
  }
  // "sent" means accepted by Postmark, not confirmed delivery to an inbox.
  return { status: "sent", provider: "postmark" };
}
