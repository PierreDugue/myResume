import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/** Turns a PostgreSQL unique violation (23505) into a 409, rethrows anything else. */
export function rethrowUniqueViolation(error: unknown, message: string): never {
  if (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === '23505'
  ) {
    throw new ConflictException(message);
  }
  throw error;
}
