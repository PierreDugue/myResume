import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { QualityTests } from '@my-resume/api-models';
import { formatPassRate, projectRows, suiteRows } from '../../quality-view';

/** Test counts per suite (unit, integration, e2e) and per project, as tables. */
@Component({
  selector: 'app-test-results',
  imports: [NgTemplateOutlet],
  templateUrl: './test-results.html',
  styleUrl: './test-results.scss',
})
export class TestResults {
  readonly tests = input.required<QualityTests>();

  protected readonly suites = computed(() => suiteRows(this.tests()));
  protected readonly projects = computed(() => projectRows(this.tests()));
  protected readonly passRate = formatPassRate;
}
