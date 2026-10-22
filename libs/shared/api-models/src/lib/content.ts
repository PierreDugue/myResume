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
  sortOrder: number;
}

export interface HighlightInput {
  /** Existing highlight of this experience, to update it. */
  id?: string;
  date: IsoDate;
  level: HighlightLevel;
  message: string;
  impact?: Impact | null;
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
  sortOrder: number;
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
