import { readdirSync } from 'node:fs';
import { MIGRATIONS } from './index';

describe('MIGRATIONS', () => {
  it('registers every migration file of this folder (the webpack bundle cannot glob files)', () => {
    const files = readdirSync(__dirname).filter(
      (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.spec.ts'),
    );
    expect(MIGRATIONS).toHaveLength(files.length);
  });
});
