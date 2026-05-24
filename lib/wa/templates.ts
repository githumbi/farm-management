// Payload builders for the pre-approved WhatsApp templates we use.
//
// Templates must be approved in the Meta Business Manager UI before sends
// will succeed. The template name + language + parameter count here MUST
// match what's approved on the WhatsApp Business Account. If you update the
// template content/structure, register a new version (`_v2`) and reference
// it from a new builder — never silently change the parameter shape.

import { sendTemplate, type WaSendResult } from "@/lib/wa/client";

export const MANAGER_ASSIGNMENT_TEMPLATE = "manager_assignment_v1";

/**
 * Sends `manager_assignment_v1` — asks the manager to confirm the
 * assignment to a farm by replying YES.
 *
 * Approved body text (must match Meta):
 *   "Hello {{1}}, {{2}} has added you as manager for {{3}}.
 *    Reply YES to confirm, NO to decline."
 */
export async function sendManagerAssignmentTemplate(opts: {
  to: string;
  managerName: string;
  ownerName: string;
  farmName: string;
  languageCode?: string;
}): Promise<WaSendResult> {
  return sendTemplate({
    to: opts.to,
    name: MANAGER_ASSIGNMENT_TEMPLATE,
    languageCode: opts.languageCode ?? "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: opts.managerName },
          { type: "text", text: opts.ownerName },
          { type: "text", text: opts.farmName },
        ],
      },
    ],
  });
}
