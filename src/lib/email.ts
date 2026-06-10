type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  error?: unknown;
};

const DEFAULT_FROM = 'bidAI <notifications@bidai.local>';

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: EmailInput) {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const to = recipients.map((email) => email.trim()).filter(Boolean);

  if (to.length === 0) return { skipped: true, reason: 'no_recipient' };

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  if (!process.env.RESEND_API_KEY) {
    console.info('[email:dry-run]', {
      to,
      from,
      subject: input.subject,
      text: input.text,
    });
    return { skipped: true, reason: 'missing_resend_api_key' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? plainTextToHtml(input.text),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as ResendResponse;

  if (!response.ok) {
    throw new Error(
      `Email send failed (${response.status}): ${
        payload.message ?? JSON.stringify(payload)
      }`,
    );
  }

  return { skipped: false, id: payload.id ?? null };
}

function plainTextToHtml(value: string) {
  return value
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
