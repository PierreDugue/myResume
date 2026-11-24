import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AssistantAnswer } from '@my-resume/api-models';
import { $ } from '../../testing';
import { AssistantExchange, AssistantExchangeView } from './assistant-exchange';

async function render(exchange: AssistantExchange) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AssistantExchangeView);
  fixture.componentRef.setInput('exchange', exchange);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}
const answered = (answer: AssistantAnswer): AssistantExchange => ({
  id: 1,
  question: 'Where did Pierre work?',
  state: 'answered',
  answer,
});
const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('AssistantExchangeView', () => {
  it('shows the question and "Thinking…" while the answer is pending', async () => {
    const el = await render({ id: 1, question: 'Where did Pierre work?', state: 'pending' });
    expect(text(el)).toContain('Where did Pierre work?');
    expect(text(el)).toContain('Thinking…');
    expect(el.querySelector('a')).toBeNull();
  });

  it('shows the question and its answer', async () => {
    const el = await render(answered({ answer: 'At KX, since 2020.', explore: null }));
    expect(text(el)).toContain('Where did Pierre work?');
    expect(text(el)).toContain('At KX, since 2020.');
    expect(text(el)).not.toContain('Thinking…');
  });

  it.each<[string, AssistantExchange]>([
    ['pending', { id: 1, question: 'q', state: 'pending' }],
    ['failed', { id: 1, question: 'q', state: 'failed', error: 'Nope.' }],
    ['answered', answered({ answer: 'a', explore: null })],
  ])('has no live region of its own when %s: the transcript announces it', async (_s, exchange) => {
    const el = await render(exchange);
    expect(el.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  });

  it('shows the error of a failed question', async () => {
    const el = await render({
      id: 1,
      question: 'Where did Pierre work?',
      state: 'failed',
      error: 'The assistant is disabled.',
    });
    expect(text(el)).toContain('Where did Pierre work?');
    expect(text(el)).toContain('The assistant is disabled.');
    expect(text(el)).not.toContain('Thinking…');
  });

  it('keeps the line breaks of the answer in the text', async () => {
    const el = await render(answered({ answer: 'First line\nSecond line', explore: null }));
    expect(el.textContent).toContain('First line\nSecond line');
  });

  it('renders an answer that contains HTML as plain text', async () => {
    const hostile = '<img src=x onerror=alert(1)> <b>bold</b>';
    const el = await render(answered({ answer: hostile, explore: null }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toContain(hostile);
  });

  it('renders a question that contains HTML as plain text', async () => {
    const el = await render({
      id: 1,
      question: '<img src=x onerror=alert(1)>',
      state: 'answered',
      answer: { answer: 'ok', explore: null },
    });
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  describe('Explore suggestion', () => {
    const query = '{company="KX"} |= "led"';

    it('links to Explore with the query, shown in a code element', async () => {
      const el = await render(answered({ answer: 'ok', explore: { query, matches: 3 } }));
      const link = $<HTMLAnchorElement>(el, 'a');
      const url = new URL(link.getAttribute('href') ?? '', 'http://localhost');
      expect(url.pathname).toBe('/explore');
      expect(url.searchParams.get('query')).toBe(query);
      expect(text(link)).toContain('Open in Explore');
      expect($(el, 'code').textContent?.trim()).toBe(query);
    });

    it.each([
      [3, '3 matching log lines'],
      [1, '1 matching log line'],
    ])('says how many lines match (%i)', async (matches, expected) => {
      const el = await render(answered({ answer: 'ok', explore: { query, matches } }));
      expect(text(el)).toContain(expected);
      if (matches === 1) expect(text(el)).not.toContain('1 matching log lines');
    });

    it('shows no link when there is no suggestion', async () => {
      const el = await render(answered({ answer: 'ok', explore: null }));
      expect(el.querySelector('a')).toBeNull();
      expect(el.querySelector('code')).toBeNull();
    });

    it('never turns text from the model into a link: only the Explore one is a link', async () => {
      const el = await render(
        answered({
          answer: 'See https://evil.example/x and [here](https://evil.example)',
          explore: null,
        }),
      );
      expect(el.querySelector('a')).toBeNull();
    });
  });
});
