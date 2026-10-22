// Angular 22 conventions enforced by lint, for every Angular project (apps/frontend, libs/frontend/*).
// The matching guidance for Claude lives in .claude/skills/angular-22/SKILL.md.
export const angular22Rules = {
  files: ['**/*.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "Decorator[expression.callee.name='Component'] > CallExpression > ObjectExpression > Property[key.name='changeDetection']",
        message:
          'Do not set changeDetection: OnPush is the default since Angular 22, and Eager is not allowed in this project.',
      },
      {
        selector:
          "Decorator[expression.callee.name='Injectable'] > CallExpression > ObjectExpression > Property[key.name='providedIn'][value.value='root']",
        message: "Use @Service() (Angular 22) instead of @Injectable({ providedIn: 'root' }).",
      },
    ],
  },
};
