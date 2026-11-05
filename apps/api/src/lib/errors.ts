import { ERROR_CODES, type ErrorCode, type ErrorDetail } from '@silk/shared';
import type { ZodError } from 'zod';

/** Error aplikasi dengan kode stabil. Service melempar ini, bukan `Error` mentah. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_CODES[code];
  }
}

export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

export const notFound = (code: ErrorCode, what: string) => new AppError(code, `${what} tidak ditemukan`);
