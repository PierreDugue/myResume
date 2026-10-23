import type {
  Education,
  Experience,
  Profile,
  Project,
  ResumeResponse,
  Skill,
} from '@my-resume/api-models';

export const skills: Skill[] = [
  {
    id: 's-angular',
    name: 'Angular',
    slug: 'angular',
    category: 'Core Frameworks',
    level: 5,
    sortOrder: 0,
  },
  {
    id: 's-ngrx',
    name: 'NgRx',
    slug: 'ngrx',
    category: 'State & Reactive',
    level: null,
    sortOrder: 1,
  },
  {
    id: 's-jest',
    name: 'Jest',
    slug: 'jest',
    category: 'Testing & Tools',
    level: null,
    sortOrder: 2,
  },
];

export const kx: Experience = {
  id: 'e-kx',
  company: 'KX',
  role: 'Angular Front-End Engineer',
  location: 'Full Remote',
  startDate: '2022-09-01',
  endDate: '2025-11-30',
  summary: 'Led front-end development of a data visualization platform.',
  skillIds: ['s-angular', 's-ngrx'],
  highlights: [
    {
      id: 'h-1',
      date: '2025-11-30',
      level: 'achievement',
      message: 'Cut average page load time by 35%.',
      impact: {
        metric: 'Page load time',
        before: null,
        after: null,
        changePct: -35,
        unit: '%',
        direction: 'down-is-good',
      },
      labels: { team: 'platform' },
      skillIds: ['s-ngrx'],
      sortOrder: 0,
    },
    {
      id: 'h-2',
      date: '2025-11-30',
      level: 'milestone',
      message: 'Introduced an NX monorepo.',
      impact: null,
      labels: {},
      skillIds: [],
      sortOrder: 1,
    },
  ],
  sortOrder: 1,
};

export const whoz: Experience = {
  id: 'e-whoz',
  company: 'Whoz',
  role: 'Angular Front-End Engineer',
  location: 'Full Remote',
  startDate: '2026-05-01',
  endDate: null,
  summary: null,
  skillIds: ['s-angular'],
  highlights: [],
  sortOrder: 0,
};

export const esil: Education = {
  id: 'ed-esil',
  school: 'ESIL',
  degree: "Diplôme d'ingénieur",
  field: 'Computer Science',
  location: 'Marseille, France',
  startDate: '2008-09-01',
  endDate: '2011-06-30',
  description: null,
  sortOrder: 0,
};

export const site: Project = {
  id: 'p-site',
  slug: 'pierre-o11y',
  title: 'Pierre O11y',
  description: 'This site.',
  url: 'https://example.com',
  repoUrl: null,
  imageUrl: null,
  startDate: '2026-10-21',
  endDate: null,
  skillIds: ['s-angular'],
  spans: [
    {
      id: 'sp-spec',
      parentId: null,
      depth: 0,
      name: 'Specification',
      startDate: '2026-10-21',
      endDate: '2026-10-21',
      note: 'The spec.',
      skillIds: [],
      sortOrder: 0,
    },
    {
      id: 'sp-features',
      parentId: null,
      depth: 0,
      name: 'Features',
      startDate: '2026-10-22',
      endDate: null,
      note: null,
      skillIds: ['s-angular'],
      sortOrder: 1,
    },
    {
      id: 'sp-auth',
      parentId: 'sp-features',
      depth: 1,
      name: 'Auth',
      startDate: '2026-10-22',
      endDate: '2026-10-22',
      note: null,
      skillIds: [],
      sortOrder: 2,
    },
  ],
  sortOrder: 0,
};

export const profile: Profile = {
  fullName: 'Pierre Dugue',
  headline: 'Senior Front-End Engineer | Angular Specialist',
  summary: 'Senior Angular developer.',
  email: 'pierre@example.com',
  phone: null,
  showPhone: false,
  location: 'Nice, France',
  openToRelocation: true,
  avatarUrl: null,
  links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' }],
  interests: 'Guitar and photography.',
  yearsInIt: 14,
  yearsOfAngular: 9,
};

export const resume: ResumeResponse = {
  profile: { ...profile, showPhone: undefined } as unknown as ResumeResponse['profile'],
  experiences: [whoz, kx],
  education: [esil],
  skills,
  projects: [site],
};
