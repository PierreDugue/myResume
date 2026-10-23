import { mentionedSkills } from './mentioned-skills';

const skills = [
  { id: 'angular', name: 'Angular' },
  { id: 'angularjs', name: 'AngularJS' },
  { id: 'java', name: 'Java/J2EE' },
  { id: 'js', name: 'JavaScript (ES6+)' },
  { id: 'git', name: 'Git' },
  { id: 'cicd', name: 'CI/CD' },
  { id: 'spring', name: 'Spring' },
];
const ids = (message: string) => mentionedSkills(message, skills);

describe('mentionedSkills', () => {
  it('finds the skills a message names, as whole words', () => {
    expect(ids('Delivered full AngularJS 1.6 to Angular 6 migration.')).toEqual([
      'angular',
      'angularjs',
    ]);
    expect(ids('Pushed to GitHub with Git.')).toEqual(['git']);
    expect(ids('Built with SpringBoot')).toEqual([]);
  });

  it('handles names with punctuation', () => {
    expect(ids('Projects in Java/J2EE and JavaScript (ES6+), with CI/CD.')).toEqual([
      'java',
      'js',
      'cicd',
    ]);
  });

  it('is case-sensitive, so ordinary words are not mistaken for skills', () => {
    expect(ids('the angular momentum of git')).toEqual([]);
  });

  it('returns ids in the order of the skills list', () => {
    expect(ids('Git, then Angular')).toEqual(['angular', 'git']);
  });
});
