import { applyEach, email, max, maxLength, min, required, schema } from '@angular/forms/signals';
import type { Profile, ProfileLink } from '@my-resume/api-models';
import { httpUrl, textOrNull } from '../shared/form-utils';

/** The profile form model, shared by the profile screen and the in-place resume editor. */
export interface ProfileModel {
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string;
  showPhone: boolean;
  location: string;
  openToRelocation: boolean;
  avatarUrl: string;
  interests: string;
  yearsInIt: number | null;
  yearsOfAngular: number | null;
  links: ProfileLink[];
}

export const EMPTY_PROFILE: ProfileModel = {
  fullName: '',
  headline: '',
  summary: '',
  email: '',
  phone: '',
  showPhone: false,
  location: '',
  openToRelocation: false,
  avatarUrl: '',
  interests: '',
  yearsInIt: null,
  yearsOfAngular: null,
  links: [],
};

/** The API accepts at most this many links. */
export const MAX_LINKS = 10;

export function toProfileModel(p: Profile): ProfileModel {
  return {
    ...p,
    phone: p.phone ?? '',
    location: p.location ?? '',
    avatarUrl: p.avatarUrl ?? '',
    interests: p.interests ?? '',
    links: p.links.map((l) => ({ ...l })),
  };
}

export function toProfile(m: ProfileModel): Profile {
  return {
    fullName: m.fullName.trim(),
    headline: m.headline.trim(),
    summary: m.summary.trim(),
    email: m.email.trim(),
    phone: textOrNull(m.phone),
    showPhone: m.showPhone,
    location: textOrNull(m.location),
    openToRelocation: m.openToRelocation,
    avatarUrl: textOrNull(m.avatarUrl),
    links: m.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    interests: textOrNull(m.interests),
    yearsInIt: m.yearsInIt,
    yearsOfAngular: m.yearsOfAngular,
  };
}

export const profileSchema = schema<ProfileModel>((p) => {
  required(p.fullName, { message: 'Full name is required' });
  maxLength(p.fullName, 120, { message: 'Use at most 120 characters' });
  required(p.headline, { message: 'Headline is required' });
  maxLength(p.headline, 200, { message: 'Use at most 200 characters' });
  required(p.summary, { message: 'Summary is required' });
  maxLength(p.summary, 2000, { message: 'Use at most 2000 characters' });
  required(p.email, { message: 'Email is required' });
  email(p.email, { message: 'Enter a valid email address' });
  httpUrl(p.avatarUrl);
  for (const years of [p.yearsInIt, p.yearsOfAngular]) {
    min(years, 0, { message: 'Enter a number from 0 to 80' });
    max(years, 80, { message: 'Enter a number from 0 to 80' });
  }
  applyEach(p.links, (link) => {
    required(link.label, { message: 'Label is required' });
    maxLength(link.label, 40, { message: 'Use at most 40 characters' });
    required(link.url, { message: 'Enter a URL starting with http:// or https://' });
    httpUrl(link.url);
  });
});
