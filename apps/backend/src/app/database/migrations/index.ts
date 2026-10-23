import type { MixedList } from 'typeorm';
import { CreateAdminUser1792663184655 } from './1792663184655-CreateAdminUser';
import { CreateContent1792669952176 } from './1792669952176-CreateContent';
import { SeedResume1792669998403 } from './1792669998403-SeedResume';
import { AddHighlightLabelsAndSkills1792736353500 } from './1792736353500-AddHighlightLabelsAndSkills';
import { TagHighlightSkills1792736365265 } from './1792736365265-TagHighlightSkills';
import { AddProjectSpans1792744929736 } from './1792744929736-AddProjectSpans';
import { SeedProjectSpans1792744955583 } from './1792744955583-SeedProjectSpans';

/**
 * Every migration of this folder, in order. The backend is bundled with webpack, so TypeORM cannot
 * load migrations with a glob: add each new migration class here (a test checks nothing is missing).
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const MIGRATIONS: MixedList<Function | string> = [
  CreateAdminUser1792663184655,
  CreateContent1792669952176,
  SeedResume1792669998403,
  AddHighlightLabelsAndSkills1792736353500,
  TagHighlightSkills1792736365265,
  AddProjectSpans1792744929736,
  SeedProjectSpans1792744955583,
];
