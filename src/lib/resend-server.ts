import 'server-only';
import { z } from 'zod';
import { sendResendEmail, type ResendConfig, type TransactionalEmail } from './resend';
export function resendConfig(): ResendConfig | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = process.env.RESEND_REPLY_TO || 'luwangtech0@gmail.com';
  const sender = from?.match(/<([^<>]+)>$/)?.[1] ?? from;
  if (
    !key ||
    key.length < 20 ||
    !/^re_[A-Za-z0-9_-]+$/.test(key) ||
    !from ||
    !z.email().safeParse(sender).success ||
    /[\r\n]/.test(from) ||
    !z.email().safeParse(replyTo).success
  )
    return null;
  return { key, from, replyTo };
}
export function sendOrderEmail(input: TransactionalEmail) {
  const config = resendConfig();
  if (!config) throw new Error('Email is not configured.');
  return sendResendEmail(input, config);
}
