import { ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

const CRON_SECRET_HEADERS = ['x-cron-secret', 'x-secret-key', 'secret-key'];

export function isCronSecretRequest(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest();
  const configuredSecret = process.env.SECRET_KEY;

  if (!configuredSecret) {
    return false;
  }

  const providedSecret = CRON_SECRET_HEADERS.map(
    (header) => request.headers?.[header],
  ).find(Boolean);

  if (!providedSecret) {
    return false;
  }

  const secret = Array.isArray(providedSecret)
    ? providedSecret[0]
    : providedSecret;

  if (typeof secret !== 'string') {
    return false;
  }

  const expected = Buffer.from(configuredSecret);
  const actual = Buffer.from(secret);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
