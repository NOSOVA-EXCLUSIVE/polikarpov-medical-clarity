import "server-only";

import type { Inngest } from "inngest";

import { env } from "@/lib/env/server";
import { assertPreviewAllowedOperation, assertPreviewIsolation } from "@/lib/preview/guard";

const previewContext = assertPreviewIsolation();

export const inngest: Inngest = previewContext
  ? new Proxy({} as Inngest, {
      get() {
        assertPreviewAllowedOperation("jobs:inngest");
        throw new Error("Preview Inngest is disabled.");
      }
    })
  : (() => {
      const { Inngest: InngestConstructor } = require("inngest") as typeof import("inngest");
      return new InngestConstructor({ id: env.INNGEST_APP_ID, eventKey: env.INNGEST_EVENT_KEY });
    })();
