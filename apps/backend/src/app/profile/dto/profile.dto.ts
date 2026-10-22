import type {
  Profile,
  ProfileLink,
  PublicProfile,
  UpdateProfileRequest,
} from '@my-resume/api-models';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsHttpUrl } from '../../common/validators';
import type { ProfileEntity } from '../entities/profile.entity';

export class ProfileLinkDto implements ProfileLink {
  @IsString()
  @Length(1, 40)
  label!: string;

  @IsHttpUrl()
  url!: string;
}

/** PUT replaces the whole profile: every key is required, nullable ones accept null. */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsString()
  @Length(1, 120)
  fullName!: string;

  @IsString()
  @Length(1, 200)
  headline!: string;

  @IsString()
  @Length(1, 2000)
  summary!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  phone!: string | null;

  @IsBoolean()
  showPhone!: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  location!: string | null;

  @IsBoolean()
  openToRelocation!: boolean;

  @IsOptional()
  @IsHttpUrl()
  avatarUrl!: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProfileLinkDto)
  links!: ProfileLinkDto[];

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  interests!: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsInIt!: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsOfAngular!: number | null;
}

export function toProfile(e: ProfileEntity): Profile {
  return {
    fullName: e.fullName,
    headline: e.headline,
    summary: e.summary,
    email: e.email,
    phone: e.phone,
    showPhone: e.showPhone,
    location: e.location,
    openToRelocation: e.openToRelocation,
    avatarUrl: e.avatarUrl,
    links: e.links.map(({ label, url }) => ({ label, url })),
    interests: e.interests,
    yearsInIt: e.yearsInIt,
    yearsOfAngular: e.yearsOfAngular,
  };
}

/** What visitors see: no showPhone flag, and the phone only when it is meant to be shown. */
export function toPublicProfile(e: ProfileEntity): PublicProfile {
  const { showPhone, ...profile } = toProfile(e);
  return { ...profile, phone: showPhone ? profile.phone : null };
}
