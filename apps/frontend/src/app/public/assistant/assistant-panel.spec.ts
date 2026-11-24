import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AssistantAnswer } from '@my-resume/api-models';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AssistantApi } from '../../core/assistant/assistant-api.service';
import { $ } from '../../testing';
import { type } from '../../admin/testing/render';
import { AssistantPanel } from './assistant-panel';

const answer = (text: string, explore: AssistantAnswer['explore'] = null): AssistantAnswer => ({
  answer: text,
  explore,
});

describe('AssistantPanel', () => {
  let reply: (question: string) => Observable<AssistantAnswer>;
  const ask = vi.fn((question: string) => reply(question));
  let fixture: ComponentFixture<AssistantPanel>;
  let el: HTMLElement;

  const settle = async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const textarea = () => $<HTMLTextAreaElement>(el, 'textarea');
  const submitButton = () => $<HTMLButtonElement>(el, 'button[type="submit"]');
  const key = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    textarea().dispatchEvent(event);
    return event;
  };
  const write = async (value: string) => {
    type(textarea(), value);
    await settle();
  };
  const send = async (question: string) => {
    await write(question);
    submitButton().click();
    await settle();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const exchanges = () => el.querySelectorAll('app-assistant-exchange');

  beforeEach(async () => {
    reply = () => of(answer('An answer.'));
    ask.mockClear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AssistantApi, useValue: { ask } }],
    });
    fixture = TestBed.createComponent(AssistantPanel);
    el = fixture.nativeElement as HTMLElement;
    await settle();
  });

  describe('when empty', () => {
    it('suggests example questions, and asking one sends it', async () => {
      const examples = [
        ...el.querySelectorAll<HTMLButtonElement>('[aria-label="Example questions"] button'),
      ];
      expect(examples.length).toBeGreaterThan(0);
      const first = examples[0].textContent?.trim() ?? '';
      expect(first).not.toBe('');

      examples[0].click();
      await settle();

      expect(ask).toHaveBeenCalledExactlyOnceWith(first);
      expect(text()).toContain(first);
      expect(text()).toContain('An answer.');
    });

    it('stops suggesting once a question is asked', async () => {
      await send('Where does Pierre work?');
      expect(el.querySelector('[aria-label="Example questions"]')).toBeNull();
    });

    it('tells that answers come from an AI and are only based on the resume', () => {
      expect(text()).toMatch(/AI/);
      expect(text()).toMatch(/resume/i);
    });
  });

  describe('asking', () => {
    it('shows the question, then "Thinking…", then the answer', async () => {
      const pending = new Subject<AssistantAnswer>();
      reply = () => pending;
      await send('Where does Pierre work?');

      expect(ask).toHaveBeenCalledExactlyOnceWith('Where does Pierre work?');
      expect(text()).toContain('Where does Pierre work?');
      expect(text()).toContain('Thinking…');

      pending.next(answer('At KX.'));
      pending.complete();
      await settle();
      expect(text()).not.toContain('Thinking…');
      expect(text()).toContain('At KX.');
    });

    it('sends the question trimmed, and empties the box', async () => {
      await send('   Where does Pierre work?  \n');
      expect(ask).toHaveBeenCalledExactlyOnceWith('Where does Pierre work?');
      expect(textarea().value).toBe('');
    });

    it('keeps the box enabled while pending, but ignores a second question', async () => {
      const pending = new Subject<AssistantAnswer>();
      reply = () => pending;
      await send('First');
      expect(textarea().disabled).toBe(false);

      await write('Second');
      submitButton().click();
      key({ key: 'Enter' });
      await settle();
      expect(ask).toHaveBeenCalledOnce();

      pending.next(answer('Done.'));
      pending.complete();
      await settle();
      expect(textarea().disabled).toBe(false);
      await send('Second');
      expect(ask).toHaveBeenCalledTimes(2);
    });

    it('keeps the focus in the box while the question is pending and after the answer', async () => {
      const pending = new Subject<AssistantAnswer>();
      reply = () => pending;
      textarea().focus();
      await write('First');
      key({ key: 'Enter' });
      await settle();
      expect(document.activeElement).toBe(textarea());

      pending.next(answer('Done.'));
      pending.complete();
      await settle();
      expect(document.activeElement).toBe(textarea());
    });

    it('keeps the focus in the box after an error', async () => {
      reply = () => throwError(() => new HttpErrorResponse({ status: 502, error: '<html>' }));
      textarea().focus();
      await write('First');
      key({ key: 'Enter' });
      await settle();
      expect(document.activeElement).toBe(textarea());
    });

    it('does not send a blank question', async () => {
      await send('   \n  ');
      expect(ask).not.toHaveBeenCalled();
      expect(exchanges()).toHaveLength(0);
    });

    it('does not send a question over 500 characters after trimming', async () => {
      await send('a'.repeat(501));
      expect(ask).not.toHaveBeenCalled();
      expect(exchanges()).toHaveLength(0);
    });

    it('sends a question of exactly 500 characters once trimmed', async () => {
      await send(`  ${'a'.repeat(500)}  `);
      expect(ask).toHaveBeenCalledExactlyOnceWith('a'.repeat(500));
    });

    it('shows how many characters are left', async () => {
      await write('hello');
      expect(text()).toContain('495');
      await write('a'.repeat(510));
      expect(text()).toContain('-10');
    });

    it('submits with Enter', async () => {
      await write('Via the keyboard');
      const event = key({ key: 'Enter' });
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(ask).toHaveBeenCalledExactlyOnceWith('Via the keyboard');
    });

    it('adds a line with Shift+Enter instead of submitting', async () => {
      await write('Two\nlines');
      const event = key({ key: 'Enter', shiftKey: true });
      await settle();
      expect(event.defaultPrevented).toBe(false);
      expect(ask).not.toHaveBeenCalled();
    });
  });

  describe('answers', () => {
    it('shows the Explore suggestion of an answer as a link', async () => {
      const query = '{type="education"}';
      reply = () => of(answer('Two degrees.', { query, matches: 2 }));
      await send('What did Pierre study?');

      const link = $<HTMLAnchorElement>(el, 'a');
      const url = new URL(link.getAttribute('href') ?? '', 'http://localhost');
      expect(url.pathname).toBe('/explore');
      expect(url.searchParams.get('query')).toBe(query);
      expect(text()).toContain('2 matching log lines');
    });

    it('shows no link when the answer has no suggestion', async () => {
      await send('Hi');
      expect(el.querySelector('a')).toBeNull();
    });

    it('renders HTML in an answer as text', async () => {
      reply = () => of(answer('<img src=x onerror=alert(1)>'));
      await send('Hi');
      expect(el.querySelector('img')).toBeNull();
      expect(text()).toContain('<img src=x onerror=alert(1)>');
    });

    it('announces the transcript politely, in one live region', async () => {
      await send('Hi');
      const regions = el.querySelectorAll('[aria-live]');
      expect(regions).toHaveLength(1);
      expect(regions[0].getAttribute('aria-live')).toBe('polite');
      expect(regions[0].textContent).toContain('An answer.');
    });

    it('keeps the earlier exchanges, in order, when asking again', async () => {
      reply = (q) => of(answer(`Answer to ${q}`));
      await send('One');
      await send('Two');
      expect(exchanges()).toHaveLength(2);
      expect(text().indexOf('Answer to One')).toBeLessThan(text().indexOf('Answer to Two'));
    });

    it('keeps only the last 20 exchanges', async () => {
      reply = (q) => of(answer(`Answer to ${q}`));
      for (let i = 1; i <= 21; i++) await send(`Question ${i}`);
      expect(exchanges()).toHaveLength(20);
      expect(text()).not.toContain('Question 1 ');
      expect(text()).not.toContain('Answer to Question 1 ');
      expect(text()).toContain('Question 2 ');
      expect(text()).toContain('Question 21');
    });
  });

  describe('errors', () => {
    it('explains the rate limit under the question, and allows asking again', async () => {
      reply = () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 429,
              error: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
            }),
        );
      await send('Too many');
      expect(text()).toContain('Too many');
      expect(text()).toContain(
        "You've asked a lot of questions in a short time. Try again in a few minutes.",
      );
      expect(text()).not.toContain('Thinking…');
      expect(textarea().disabled).toBe(false);
    });

    it('explains an assistant that is disabled, with the server message', async () => {
      reply = () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { statusCode: 404, message: 'The assistant is disabled', error: 'Not Found' },
            }),
        );
      await send('Hello');
      expect(text()).toContain('The assistant is disabled.');
    });

    it('keeps a failed exchange next to the ones that worked', async () => {
      await send('Works');
      reply = () => throwError(() => new HttpErrorResponse({ status: 502, error: '<html>' }));
      await send('Fails');
      expect(exchanges()).toHaveLength(2);
      expect(text()).toContain('An answer.');
      expect(text()).toContain("The assistant couldn't answer. Try again in a moment.");
    });
  });

  it('emits "closed" from its close button', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const close = [...el.querySelectorAll('button')].find((b) =>
      /close/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''),
    );
    expect(close).toBeDefined();
    close?.click();
    expect(closed).toHaveBeenCalledOnce();
  });
});
