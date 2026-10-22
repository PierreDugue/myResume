import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

/** Renders `url` with real routing (route params, data, navigation) and returns helpers. */
export async function renderRoute(url: string, routes: Route[], providers: Provider[] = []) {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), ...providers] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  harness.detectChanges();
  await harness.fixture.whenStable();
  const el = harness.fixture.nativeElement as HTMLElement;
  const router = TestBed.inject(Router);
  return {
    harness,
    el,
    router,
    /**
     * Lets pending work finish, then renders. Signal-form submit actions end in promises that
     * fake APIs don't register as pending tasks, so flush the task queue before `whenStable()`.
     */
    settle: async () => {
      harness.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    },
  };
}

/** Types into an input/textarea/select the way a user does. */
export function type(el: Element | null, value: string): void {
  if (!el) throw new Error('Field not found');
  const field = el as HTMLInputElement;
  field.value = value;
  // Browsers fire `input` on text fields and both `input` and `change` on selects.
  field.dispatchEvent(new Event('input'));
  if (field.tagName === 'SELECT') field.dispatchEvent(new Event('change'));
}

export function field(root: HTMLElement, label: string): HTMLInputElement {
  const labelEl = [...root.querySelectorAll('label')].find((l) =>
    l.textContent?.trim().startsWith(label),
  );
  const id = labelEl?.getAttribute('for');
  const input = id ? root.querySelector<HTMLInputElement>(`[id="${id}"]`) : null;
  if (!input) throw new Error(`No field labelled "${label}"`);
  return input;
}
