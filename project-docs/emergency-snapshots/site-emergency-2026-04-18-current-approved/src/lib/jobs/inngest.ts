import "server-only";

import { Inngest } from "inngest";

import { env } from "@/lib/env/server";

export const inngest = new Inngest({
  id: env.INNGEST_APP_ID,
  eventKey: env.INNGEST_EVENT_KEY
});
