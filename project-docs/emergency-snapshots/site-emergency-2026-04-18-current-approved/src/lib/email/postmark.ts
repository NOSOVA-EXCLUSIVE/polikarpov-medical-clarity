import "server-only";

import { ServerClient } from "postmark";

import { env } from "@/lib/env/server";

let postmarkClient: ServerClient | null = null;

export function getPostmarkClient() {
  if (!postmarkClient) {
    postmarkClient = new ServerClient(env.POSTMARK_SERVER_TOKEN);
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
}) {
  const envelope = getDefaultEmailEnvelope();

  await getPostmarkClient().sendEmail({
    From: envelope.from,
    ReplyTo: envelope.replyTo,
    To: Array.isArray(input.to) ? input.to.join(",") : input.to,
    Subject: input.subject,
    HtmlBody: input.htmlBody,
    TextBody: input.textBody
  });
}
