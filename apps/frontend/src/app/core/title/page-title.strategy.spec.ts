import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_NAME } from '../app-name';
import { PageTitleStrategy, providePageTitleStrategy } from './page-title.strategy';

@Component({ template: '' })
class Blank {}

describe('PageTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', title: 'Career Overview', component: Blank },
          { path: 'untitled', component: Blank },
        ]),
        providePageTitleStrategy(),
      ],
    });
  });

  it('sets the document title to "<page> · <app name>" and exposes the page title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Title).getTitle()).toBe(`Career Overview · ${APP_NAME}`);
    expect(TestBed.inject(PageTitleStrategy).pageTitle()).toBe('Career Overview');
  });

  it('falls back to the app name for routes without a title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/untitled');

    expect(TestBed.inject(Title).getTitle()).toBe(APP_NAME);
    expect(TestBed.inject(PageTitleStrategy).pageTitle()).toBe(APP_NAME);
  });
});
