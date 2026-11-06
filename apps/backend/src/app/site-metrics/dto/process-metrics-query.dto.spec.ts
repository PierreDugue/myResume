import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProcessMetricsQueryDto } from './process-metrics-query.dto';

async function check(query: Record<string, unknown>) {
  const dto = plainToInstance(ProcessMetricsQueryDto, query);
  return { dto, errors: await validate(dto) };
}

describe('ProcessMetricsQueryDto', () => {
  it('leaves `since` undefined when it is not sent', async () => {
    const { dto, errors } = await check({});
    expect(errors).toEqual([]);
    expect(dto.since).toBeUndefined();
  });

  it('converts `since` to epoch ms once, when the query is transformed', async () => {
    const { dto, errors } = await check({ since: '2026-11-05T12:00:00+02:00' });
    expect(errors).toEqual([]);
    expect(dto.since).toBe(Date.UTC(2026, 10, 5, 10, 0, 0));
  });

  it.each([
    ['unparseable', 'yesterday'],
    ['empty', ''],
    ['without an offset', '2026-11-05T10:00:00'],
    ['too long', `2026-11-05T10:00:00.${'0'.repeat(30)}Z`],
    ['repeated', ['2026-11-05T10:00:00Z', '2026-11-05T10:00:01Z']],
    ['not a string', 42],
  ])('refuses a `since` that is %s, with one message', async (_case, since) => {
    const { errors } = await check({ since });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toEqual([
      'since must be an ISO 8601 timestamp of at most 40 characters, with an offset (Z or ±hh:mm) when it has a time',
    ]);
  });
});
