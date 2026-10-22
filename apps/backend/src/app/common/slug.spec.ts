import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Angular', 'angular'],
    ['CSS3/SASS', 'css3-sass'],
    ['Java/J2EE', 'java-j2ee'],
    ['Angular (v2–v22)', 'angular-v2-v22'],
    ['Pierre O11y — this site', 'pierre-o11y-this-site'],
    ['Diplôme d’ingénieur', 'diplome-d-ingenieur'],
    ['  --Node.js--  ', 'node-js'],
    ['C#', 'c'],
  ])('%s -> %s', (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
