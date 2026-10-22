import { BadRequestException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

/** A reorder request must list every existing id exactly once (docs/api-contract.md). */
export function assertSameIds(existing: string[], ids: string[]): void {
  const wanted = new Set(ids);
  const same =
    wanted.size === ids.length &&
    ids.length === existing.length &&
    existing.every((id) => wanted.has(id));
  if (!same) throw new BadRequestException('ids must contain every existing id exactly once');
}

/** The sortOrder for a new item: after the last one. */
export async function nextSortOrder<T extends ObjectLiteral>(
  manager: EntityManager,
  target: EntityTarget<T>,
): Promise<number> {
  const max = await manager.getRepository(target).maximum('sortOrder' as never);
  return (max ?? -1) + 1;
}

/** Applies `PUT …/order`: checks the ids, then saves positions 0..n-1 in one transaction. */
export async function applyOrder<T extends ObjectLiteral & { id: string }>(
  manager: EntityManager,
  target: EntityTarget<T>,
  ids: string[],
): Promise<void> {
  await manager.transaction(async (tx) => {
    const repo = tx.getRepository(target);
    const existing = (await repo.find({ select: { id: true } as never })) as T[];
    assertSameIds(
      existing.map((e) => e.id),
      ids,
    );
    for (const [index, id] of ids.entries()) {
      await repo.update(id, { sortOrder: index } as never);
    }
  });
}
