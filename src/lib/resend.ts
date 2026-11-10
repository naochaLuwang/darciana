export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  eventKey: string;
};
export type ResendConfig = { key: string; from: string; replyTo: string };
export type EmailSendResult = { id?: string; error?: 'provider_rejected' | 'network_unknown' };
export async function sendResendEmail(
  input: TransactionalEmail,
  config: ResendConfig,
  send: typeof fetch = fetch,
): Promise<EmailSendResult> {
  try {
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.eventKey,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        reply_to: config.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = await response.json().catch(() => null);
    return response.ok && typeof body?.id === 'string'
      ? { id: body.id }
      : { error: 'provider_rejected' };
  } catch {
    // The provider may have accepted a request whose response was lost.
    return { error: 'network_unknown' };
  }
}
