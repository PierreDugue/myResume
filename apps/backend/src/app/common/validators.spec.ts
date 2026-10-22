import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsIsoDate, IsOnOrAfter } from './validators';

class Period {
  @IsIsoDate()
  startDate!: string;

  @IsIsoDate({ optional: true })
  @IsOnOrAfter('startDate')
  endDate?: string | null;
}

const errors = (value: object) =>
  validateSync(plainToInstance(Period, value)).map((e) => e.property);

describe('date validators', () => {
  it('accepts real YYYY-MM-DD dates, and an empty end date', () => {
    expect(errors({ startDate: '2022-09-01', endDate: '2025-11-30' })).toEqual([]);
    expect(errors({ startDate: '2024-02-29', endDate: null })).toEqual([]);
    expect(errors({ startDate: '2022-09-01' })).toEqual([]);
  });

  it.each(['2022-13-01', '2023-02-29', '2022-9-1', '01/09/2022', '2022-09-01T00:00:00Z', ''])(
    'rejects %j as a date',
    (startDate) => {
      expect(errors({ startDate })).toContain('startDate');
    },
  );

  it('rejects an end date before the start date, accepts the same day', () => {
    expect(errors({ startDate: '2022-09-01', endDate: '2022-08-31' })).toEqual(['endDate']);
    expect(errors({ startDate: '2022-09-01', endDate: '2022-09-01' })).toEqual([]);
  });
});
