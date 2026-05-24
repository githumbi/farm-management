// Thin wrapper around the Meta Graph (WhatsApp Cloud) API.
//
// Endpoints documented at:
//   https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
//
// We only model the subset we use today: outbound templates + plain text.
// All calls go via `fetch` so this works in both the Next.js server runtime
// and (later) the BullMQ worker process.

type MetaError = {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
};

export type WaSendResult =
  | { ok: true; wa_message_id: string }
  | { ok: false; error: string; raw?: unknown };

function apiBase(): string {
  const version = process.env.WA_API_VERSION ?? "v25.0";
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  if (!phoneId) {
    throw new Error("WA_PHONE_NUMBER_ID is not set");
  }
  return `https://graph.facebook.com/${version}/${phoneId}`;
}

function authHeaders(): HeadersInit {
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token) throw new Error("WA_ACCESS_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function sendMessage(body: unknown): Promise<WaSendResult> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/messages`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }

  const raw = await res.json().catch(() => null);

  if (!res.ok) {
    const metaErr = raw as { error?: MetaError } | null;
    return {
      ok: false,
      error:
        metaErr?.error?.message ??
        `Meta API responded ${res.status} ${res.statusText}`,
      raw,
    };
  }

  const ok = raw as {
    messages?: Array<{ id: string }>;
  } | null;
  const id = ok?.messages?.[0]?.id;
  if (!id) {
    return { ok: false, error: "Meta API did not return a message id", raw };
  }
  return { ok: true, wa_message_id: id };
}

export async function sendTemplate(opts: {
  to: string;
  name: string;
  languageCode: string;
  components?: unknown[];
}): Promise<WaSendResult> {
  return sendMessage({
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: opts.name,
      language: { code: opts.languageCode },
      components: opts.components ?? [],
    },
  });
}

export async function sendText(opts: {
  to: string;
  body: string;
  preview_url?: boolean;
}): Promise<WaSendResult> {
  return sendMessage({
    messaging_product: "whatsapp",
    to: opts.to,
    type: "text",
    text: { body: opts.body, preview_url: opts.preview_url ?? false },
  });
}
