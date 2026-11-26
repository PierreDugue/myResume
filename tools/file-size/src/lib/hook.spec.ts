import { hookFeedback } from './hook.ts';

const lines = (n: number) => 'x\n'.repeat(n);
const edit = (file_path: unknown) => ({ tool_name: 'Edit', tool_input: { file_path } });

describe('hookFeedback (Claude Code PostToolUse on Write/Edit)', () => {
  it('asks to split a source file that is now over the maximum', () => {
    const feedback = hookFeedback(edit('/repo/apps/x/big.ts'), () => lines(801));
    expect(feedback).toContain('/repo/apps/x/big.ts');
    expect(feedback).toContain('801');
    expect(feedback).toContain('800');
  });

  it('says nothing for a source file at the maximum', () => {
    expect(hookFeedback(edit('/repo/apps/x/ok.ts'), () => lines(800))).toBeNull();
  });

  it('says nothing for files the check ignores, however long', () => {
    expect(hookFeedback(edit('/repo/docs/api-contract.md'), () => lines(5000))).toBeNull();
  });

  it('says nothing when the file is gone or unreadable', () => {
    expect(hookFeedback(edit('/repo/apps/x/gone.ts'), () => null)).toBeNull();
  });

  it.each([null, 'not an object', {}, { tool_input: {} }, edit(42)])(
    'ignores input without a file path: %j',
    (input) => {
      expect(hookFeedback(input, () => lines(5000))).toBeNull();
    },
  );
});
