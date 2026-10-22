import type { HighlightLevel, Impact, Profile } from '@my-resume/api-models';

/**
 * Initial content, taken from Pierre's resume (PDF, October 2026). Loaded once by the SeedResume
 * migration on an empty database; afterwards the admin panel is the source of truth.
 * Deliberately absent: the phone number (add it in the admin if wanted) and skill levels.
 */

export const SEED_PROFILE: Profile = {
  fullName: 'Pierre Dugue',
  headline: 'Senior Front-End Engineer | Angular Specialist',
  summary:
    'Senior Angular Developer with 9+ years of hands-on Angular experience and 14+ years of overall IT experience in enterprise web application development. Strong expertise in designing scalable front-end architectures, building responsive web applications, integrating REST APIs, and collaborating in Agile/Scrum environments. Proven ability to act as a technical interface between business stakeholders and development teams.',
  email: 'pierre.dugue1@gmail.com',
  phone: null,
  showPhone: false,
  location: 'Nice, France',
  openToRelocation: true,
  avatarUrl: null,
  links: [],
  interests:
    'Guitarist and photographer with a strong interest in visual arts, digital painting, 3D animation, and web design. This passion for aesthetics and craft directly informs an eye for detail and quality in UI work.',
  yearsInIt: 14,
  yearsOfAngular: 9,
};

/** [name, category], in display order. */
export const SEED_SKILLS: [string, string][] = [
  ['Angular', 'Core Frameworks'],
  ['AngularJS', 'Core Frameworks'],
  ['React', 'Core Frameworks'],
  ['VueJs', 'Core Frameworks'],
  ['NestJS', 'Core Frameworks'],
  ['Django', 'Core Frameworks'],
  ['TypeScript', 'Languages'],
  ['JavaScript (ES6+)', 'Languages'],
  ['Java/J2EE', 'Languages'],
  ['HTML5', 'Languages'],
  ['CSS3/SASS', 'Languages'],
  ['Python', 'Languages'],
  ['NgRx', 'State & Reactive'],
  ['RxJS', 'State & Reactive'],
  ['Redux', 'State & Reactive'],
  ['Cypress', 'Testing & Tools'],
  ['Jest', 'Testing & Tools'],
  ['Angular CLI', 'Testing & Tools'],
  ['Webpack', 'Testing & Tools'],
  ['NX', 'Testing & Tools'],
  ['Angular Material', 'UI Libraries'],
  ['PrimeNG', 'UI Libraries'],
  ['KendoUI', 'UI Libraries'],
  ['Bootstrap', 'UI Libraries'],
  ['REST APIs', 'API & Integration'],
  ['JSON', 'API & Integration'],
  ['Code review', 'Tooling'],
  ['Git', 'Tooling'],
  ['Bitbucket', 'Tooling'],
  ['Jira', 'Tooling'],
  ['Confluence', 'Tooling'],
  ['CI/CD', 'Tooling'],
  ['Claude', 'AI'],
  ['Claude skills', 'AI'],
  ['LangChain', 'AI'],
  ['LangGraph', 'AI'],
  ['RAG', 'AI'],
  ['Spring', 'Back-end (earlier)'],
  ['Spring Boot', 'Back-end (earlier)'],
  ['Hibernate', 'Back-end (earlier)'],
  ['WinDev', 'Back-end (earlier)'],
  ['Lotus', 'Back-end (earlier)'],
];

export interface SeedHighlight {
  level: HighlightLevel;
  message: string;
  impact?: Impact;
}

export interface SeedExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string | null;
  summary: string | null;
  skills: string[];
  highlights: SeedHighlight[];
}

const pct = (metric: string, changePct: number, direction: Impact['direction']): Impact => ({
  metric,
  before: null,
  after: null,
  changePct,
  unit: '%',
  direction,
});

/** Most recent first. Highlights are dated at the end of the job (or the seed date for the current one). */
export const SEED_DATE = '2026-10-22';

export const SEED_EXPERIENCES: SeedExperience[] = [
  {
    company: 'Whoz',
    role: 'Angular Front-End Engineer',
    location: 'Full Remote',
    startDate: '2026-05-01',
    endDate: null,
    summary: 'Led front-end development of a resource management application.',
    skills: ['Angular', 'NgRx', 'RxJS', 'Jest', 'Cypress', 'NX', 'Claude', 'Claude skills'],
    highlights: [
      {
        level: 'info',
        message: 'Closely collaborating with PO and UI/UX team to design new features.',
      },
      {
        level: 'achievement',
        message: 'Generate 95% of code with Claude.',
        impact: {
          metric: 'Code generated with Claude',
          before: null,
          after: 95,
          changePct: null,
          unit: '%',
          direction: 'up-is-good',
        },
      },
      { level: 'info', message: 'Heavy focus on code reviews to ensure code quality.' },
      { level: 'learning', message: 'Improve generated code by implementing Claude AI skills.' },
    ],
  },
  {
    company: 'KX',
    role: 'Angular Front-End Engineer',
    location: 'Full Remote',
    startDate: '2022-09-01',
    endDate: '2025-11-30',
    summary:
      'Led front-end development of a complex data visualization platform, delivering high-performance user experiences across data-intensive environments.',
    skills: ['Angular', 'NgRx', 'RxJS', 'Jest', 'Cypress', 'NX'],
    highlights: [
      {
        level: 'achievement',
        message:
          'Architected and scaled 10+ UI workflows for a complex data visualization platform, transforming multi-step business requirements into intuitive user journeys and reducing user-reported friction by ~30%.',
        impact: pct('User-reported friction', -30, 'down-is-good'),
      },
      {
        level: 'achievement',
        message:
          'Refactored legacy codebase using NgRx and Angular Signals, cutting average page load time by 35%.',
        impact: pct('Page load time', -35, 'down-is-good'),
      },
      {
        level: 'achievement',
        message:
          'Established a structured Cypress E2E and Jest unit testing suite, growing code coverage from under 20% to over 75% and reducing production regression incidents by 60%.',
        impact: {
          metric: 'Code coverage',
          before: 20,
          after: 75,
          changePct: null,
          unit: '%',
          direction: 'up-is-good',
        },
      },
      {
        level: 'achievement',
        message:
          'Collaborated with the UI/UX team to implement a unified design system adopted across 5+ product areas, ensuring visual consistency and reducing design-to-dev handoff time by 25%.',
        impact: pct('Design-to-dev handoff time', -25, 'down-is-good'),
      },
      {
        level: 'milestone',
        message: 'Contributed to architectural decision-making, introducing NX monorepo structure.',
      },
    ],
  },
  {
    company: 'Winning Group',
    role: 'Angular Front-End Engineer',
    location: 'Sydney, Australia / Full Remote',
    startDate: '2019-10-01',
    endDate: '2022-04-30',
    summary:
      'Worked across multiple enterprise web applications for Winning Appliances, enhancing performance, reliability, and customer experience.',
    skills: ['Angular', 'NgRx', 'RxJS', 'HTML5', 'CSS3/SASS', 'Jest', 'Cypress', 'NX', 'NestJS'],
    highlights: [
      {
        level: 'achievement',
        message:
          'Delivered high-performance e-commerce frontend solutions that contributed to a 20% improvement in checkout conversion rate through optimised page load and streamlined UI flows.',
        impact: pct('Checkout conversion rate', 20, 'up-is-good'),
      },
      {
        level: 'info',
        message:
          'Built 30+ reusable Angular 11 components in close collaboration with Product and Design.',
      },
      {
        level: 'achievement',
        message:
          'Implemented Cypress and Jest test suites achieving 70%+ code coverage, reducing QA cycle time.',
        impact: {
          metric: 'Code coverage',
          before: null,
          after: 70,
          changePct: null,
          unit: '%',
          direction: 'up-is-good',
        },
      },
      {
        level: 'info',
        message:
          'Defined and documented front-end standards adopted across a team of 6 developers, improving code review efficiency and onboarding time for new hires.',
      },
    ],
  },
  {
    company: 'Isentia',
    role: 'Lead Angular Engineer',
    location: 'Sydney, Australia',
    startDate: '2018-10-01',
    endDate: '2019-01-31',
    summary:
      'Led end-to-end front-end development of a monitoring and alert management application built from scratch.',
    skills: ['Angular', 'NgRx', 'RxJS', 'Jest', 'Cypress', 'HTML5', 'CSS3/SASS', 'NestJS'],
    highlights: [
      {
        level: 'milestone',
        message:
          'Architected and delivered an Angular 6 application from concept to production in under 4 months, establishing scalable component architecture used in 3 other apps.',
      },
      {
        level: 'info',
        message: 'Designed efficient API contracts in collaboration with the back-end team.',
      },
      {
        level: 'achievement',
        message:
          'Produced comprehensive technical documentation that reduced onboarding time for new developers by approximately 50%.',
        impact: pct('Onboarding time', -50, 'down-is-good'),
      },
    ],
  },
  {
    company: 'Fairfax Media',
    role: 'Lead Angular Engineer',
    location: 'Sydney, Australia',
    startDate: '2018-04-01',
    endDate: '2018-09-30',
    summary: 'Led migration from AngularJS to Angular 6 for legacy publishing applications.',
    skills: ['AngularJS', 'Angular', 'RxJS', 'HTML5', 'CSS3/SASS', 'Jest'],
    highlights: [
      { level: 'milestone', message: 'Delivered full AngularJS 1.6 to Angular 6 migration.' },
      {
        level: 'achievement',
        message:
          'Mentored a team of 3 developers in modern Angular best practices, reducing PR review cycles by 30%.',
        impact: pct('PR review cycles', -30, 'down-is-good'),
      },
      {
        level: 'achievement',
        message:
          'Used migration as an opportunity to improve code architecture, resulting in a 20% reduction in bundle size.',
        impact: pct('Bundle size', -20, 'down-is-good'),
      },
    ],
  },
  {
    company: 'R3D',
    role: 'Lead Angular Engineer',
    location: 'Montréal, Canada',
    startDate: '2017-02-01',
    endDate: '2018-01-31',
    summary:
      'Sole front-end developer on a task assignment management platform for the City of Montreal.',
    skills: ['Angular', 'RxJS', 'HTML5', 'CSS3/SASS', 'TypeScript'],
    highlights: [
      {
        level: 'milestone',
        message:
          'Sole architect and developer of a full Angular application serving 200+ City of Montreal maintenance staff, delivered end-to-end within an 11-month engagement.',
      },
      {
        level: 'info',
        message: 'Designed and implemented UI/UX workflows aligned with operational needs.',
      },
    ],
  },
  {
    company: 'LXA Conseil',
    role: 'Full-Stack Developer',
    location: 'Sophia-Antipolis, France',
    startDate: '2014-03-01',
    endDate: '2015-10-31',
    summary: null,
    skills: ['Java/J2EE', 'HTML5', 'CSS3/SASS', 'Spring', 'Hibernate', 'Spring Boot', 'Bootstrap'],
    highlights: [
      {
        level: 'info',
        message:
          'Delivered multiple enterprise Java/J2EE projects for DOCAPOST, including a healthcare platform, serving a 15-person team and an electronic registered letters application built end-to-end.',
      },
      {
        level: 'info',
        message:
          'Built responsive front-end for LR COPRO using Bootstrap 3 and Thymeleaf, and contributed to back-end using Spring 3, Hibernate, and SpringBoot.',
      },
    ],
  },
  {
    company: 'Capgemini',
    role: 'Full-Stack Software Engineer',
    location: 'Nice, France',
    startDate: '2011-09-01',
    endDate: '2013-07-31',
    summary: null,
    skills: ['WinDev', 'Lotus', 'Java/J2EE'],
    highlights: [
      {
        level: 'achievement',
        message:
          'Provided third-party application maintenance (TMA) for VIRBAC across multiple tech stacks (Java/J2EE, Lotus Script, WinDev), resolving 100+ bugs and functional issues.',
        impact: {
          metric: 'Bugs resolved',
          before: null,
          after: 100,
          changePct: null,
          unit: null,
          direction: 'up-is-good',
        },
      },
      {
        level: 'info',
        message:
          'Wrote functional and technical specifications for application evolutions, acting as key liaison between client stakeholders and the development team.',
      },
    ],
  },
];

export const SEED_EDUCATION = [
  {
    school: 'ESIL',
    degree: "Diplôme d'ingénieur (Master's degree)",
    field: 'Computer Science, Network & Multimedia',
    location: 'Marseille, France',
    startDate: '2008-09-01',
    endDate: '2011-06-30',
  },
  {
    school: 'IUT R&T',
    degree: 'DUT (HND)',
    field: 'Computer Science and Multimedia',
    location: 'Nice, France',
    startDate: '2005-09-01',
    endDate: '2008-06-30',
  },
];

export const SEED_PROJECTS = [
  {
    slug: 'pierre-o11y',
    title: 'Pierre O11y — this site',
    description:
      'My resume presented as an observability platform: Angular 22 and NestJS 11 in an Nx monorepo, PostgreSQL, Docker, built test-first with Claude Code agents and skills.',
    startDate: '2026-10-21',
    skills: [
      'Angular',
      'NestJS',
      'TypeScript',
      'RxJS',
      'NX',
      'Cypress',
      'Claude',
      'Claude skills',
      'CI/CD',
    ],
  },
];
