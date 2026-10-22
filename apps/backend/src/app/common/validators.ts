import { applyDecorators } from '@nestjs/common';
import {
  IsOptional,
  IsUrl,
  Matches,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
} from 'class-validator';
import { SLUG_PATTERN } from './slug';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A real calendar date as `YYYY-MM-DD`. With `optional`, null/undefined are accepted. */
export function IsIsoDate(options: { optional?: boolean } = {}): PropertyDecorator {
  const rule: PropertyDecorator = (target, propertyName) =>
    registerDecorator({
      name: 'isIsoDate',
      target: target.constructor,
      propertyName: propertyName as string,
      validator: {
        validate: isRealIsoDate,
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must be a valid date (YYYY-MM-DD)`,
      },
    });
  return options.optional ? applyDecorators(IsOptional(), rule) : rule;
}

/** This date can't be before the date in `property` (ISO strings compare chronologically). */
export function IsOnOrAfter(property: string): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isOnOrAfter',
      target: target.constructor,
      propertyName: propertyName as string,
      constraints: [property],
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const other = (args.object as Record<string, unknown>)[property];
          return typeof value !== 'string' || typeof other !== 'string' || value >= other;
        },
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} can't be before ${property}`,
      },
    });
}

export function IsSlug(): PropertyDecorator {
  return Matches(SLUG_PATTERN, {
    message: '$property must be lowercase letters and digits separated by dashes',
  });
}

/** http(s) URL only (no javascript:, ftp:, ...). */
export function IsHttpUrl(): PropertyDecorator {
  return IsUrl({ protocols: ['http', 'https'], require_protocol: true });
}

/** Optional on input, but if present it must not be null (for required fields in PATCH bodies). */
export function IsOptionalButNotNull(): PropertyDecorator {
  return ValidateIf((_object, value) => value !== undefined);
}
