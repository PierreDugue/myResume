/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

export interface ProfileLink {
  label: string;
  url: string;
}

/** The admin's view of the profile (`GET/PUT /api/profile`). */
export interface Profile {
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string | null;
  /** `false` by default: the phone only appears in the PDF. */
  showPhone: boolean;
  location: string | null;
  openToRelocation: boolean;
  avatarUrl: string | null;
  links: ProfileLink[];
  interests: string | null;
  /** Headline figures, entered by hand. */
  yearsInIt: number | null;
  yearsOfAngular: number | null;
}

export type UpdateProfileRequest = Profile;

/** The profile as the public sees it: `phone` is null unless `showPhone`. */
export type PublicProfile = Omit<Profile, 'showPhone'>;

export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string;
  level: SkillLevel | null;
  sortOrder: number;
}

export interface CreateSkillRequest {
  name: string;
  /** Generated from the name when left out. */
  slug?: string;
  category: string;
  level?: SkillLevel | null;
}

export type UpdateSkillRequest = Partial<CreateSkillRequest>;

export type HighlightLevel = 'achievement' | 'info' | 'learning' | 'milestone';

/** A quantified result (feeds the impact panels). */
export interface Impact {
  metric: string;
  before: number | null;
  after: number | null;
  /** Percent change, e.g. -35. */
  changePct: number | null;
  unit: string | null;
  direction: 'up-is-good' | 'down-is-good';
}

/** An achievement of an experience (a future log line). */
export interface Highlight {
  id: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact: Impact | null;
  /** Free labels shown in Explore, e.g. { team: "checkout" }; {} when none. */
  labels: HighlightLabels;
  /** Technologies of this achievement, in skills-list order. */
  skillIds: string[];
  sortOrder: number;
}

/** Highlight label keys: `^[a-z][a-z0-9_]{0,29}$`, values 1..60 characters, at most 10. */
export type HighlightLabels = Record<string, string>;

export interface HighlightInput {
  /** Existing highlight of this experience, to update it. */
  id?: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact?: Impact | null;
  /** Left out = {}. */
  labels?: HighlightLabels;
  /** Left out = []. */
  skillIds?: string[];
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  location: string | null;
  startDate: IsoDate;
  /** `null` = current job. */
  endDate: IsoDate | null;
  summary: string | null;
  skillIds: string[];
  highlights: Highlight[];
  sortOrder: number;
}

export interface CreateExperienceRequest {
  company: string;
  role: string;
  location?: string | null;
  startDate: IsoDate;
  endDate?: IsoDate | null;
  summary?: string | null;
  skillIds?: string[];
  /** The complete, ordered list (see docs/api-contract.md). */
  highlights?: HighlightInput[];
}

export type UpdateExperienceRequest = Partial<CreateExperienceRequest>;

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string | null;
  location: string | null;
  startDate: IsoDate;
  endDate: IsoDate | null;
  description: string | null;
  sortOrder: number;
}

export interface CreateEducationRequest {
  school: string;
  degree: string;
  field?: string | null;
  location?: string | null;
  startDate: IsoDate;
  endDate?: IsoDate | null;
  description?: string | null;
}

export type UpdateEducationRequest = Partial<CreateEducationRequest>;

export interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string | null;
  repoUrl: string | null;
  imageUrl: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  skillIds: string[];
  /** The phases of the project's trace, in outline order. */
  spans: ProjectSpan[];
  sortOrder: number;
}

/** A phase or component of a project: a span of its trace. */
export interface ProjectSpan {
  id: string;
  /** null = a direct child of the project (the root span). */
  parentId: string | null;
  /** 0 for direct children, up to 3. */
  depth: number;
  name: string;
  startDate: IsoDate;
  /** null = ongoing. */
  endDate: IsoDate | null;
  note: string | null;
  /** In skills-list order. */
  skillIds: string[];
  /** Position in the outline. */
  sortOrder: number;
}

export interface ProjectSpanInput {
  /** Existing span of this project, to update it. */
  id?: string;
  /** The parent is the nearest span above with depth - 1. */
  depth: number;
  name: string;
  startDate: IsoDate;
  endDate?: IsoDate | null;
  note?: string | null;
  skillIds?: string[];
}

export interface CreateProjectRequest {
  /** Generated from the title when left out. */
  slug?: string;
  title: string;
  description: string;
  url?: string | null;
  repoUrl?: string | null;
  imageUrl?: string | null;
  startDate?: IsoDate | null;
  endDate?: IsoDate | null;
  skillIds?: string[];
  /** The complete outline (at most 100). */
  spans?: ProjectSpanInput[];
}

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export interface ReorderRequest {
  ids: string[];
}

/** `GET /api/resume`: everything public, already sorted. */
export interface ResumeResponse {
  profile: PublicProfile | null;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}
