import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Profile, PublicProfile } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { toProfile, toPublicProfile, UpdateProfileDto } from './dto/profile.dto';
import { ProfileEntity } from './entities/profile.entity';

/** The profile is a single row: the first one is used, PUT creates it if needed. */
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
  ) {}

  async get(): Promise<Profile> {
    const entity = await this.find();
    if (!entity) throw new NotFoundException('No profile yet');
    return toProfile(entity);
  }

  async getPublic(): Promise<PublicProfile | null> {
    const entity = await this.find();
    return entity ? toPublicProfile(entity) : null;
  }

  async replace(dto: UpdateProfileDto): Promise<Profile> {
    const entity = (await this.find()) ?? this.profiles.create();
    Object.assign(entity, {
      ...dto,
      links: dto.links.map(({ label, url }) => ({ label, url })),
    });
    return toProfile(await this.profiles.save(entity));
  }

  private async find(): Promise<ProfileEntity | null> {
    const [first] = await this.profiles.find({ order: { createdAt: 'ASC' }, take: 1 });
    return first ?? null;
  }
}
