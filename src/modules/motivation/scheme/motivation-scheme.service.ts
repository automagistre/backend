import { Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import type { MotivationScheme } from '../calculator/motivation-calculator.types';
import { buildStartScheme } from '../calculator/start-scheme';

/** Стартовая схема ищет должности по названию; дальше веса правятся в форме. */
const START_POSITION_NAMES = {
  masterId: /мастер/i,
  adminId: /администратор/i,
  partsId: /запчаст/i,
};

export type StoredMotivationScheme = {
  id: string;
  version: number;
  activeFrom: Date;
  createdAt: Date;
  scheme: MotivationScheme;
};

/** Схема для расчёта: сохранённая версия или стартовая, если версий ещё нет. */
export type ResolvedMotivationScheme = {
  stored: StoredMotivationScheme | null;
  scheme: MotivationScheme;
};

const SCHEME_SELECT = {
  id: true,
  version: true,
  activeFrom: true,
  createdAt: true,
  params: true,
} satisfies Prisma.MotivationSchemeSelect;

@Injectable()
export class MotivationSchemeService {
  constructor(private readonly prisma: PrismaService) {}

  async startScheme(tenantId: string): Promise<MotivationScheme> {
    const positions = await this.prisma.staffPosition.findMany({
      where: { tenantId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const find = (pattern: RegExp) =>
      positions.find((position) => pattern.test(position.name))?.id ?? '';
    const scheme = buildStartScheme({
      masterId: find(START_POSITION_NAMES.masterId),
      adminId: find(START_POSITION_NAMES.adminId),
      partsId: find(START_POSITION_NAMES.partsId),
    });
    // Не нашлась должность — не оставляем в профиле пустой ключ
    for (const profile of Object.values(scheme.profiles)) {
      delete profile[''];
    }
    return scheme;
  }

  /** Версия, действующая в момент `at`: последняя по дате начала, при равенстве — по номеру. */
  async activeAt(
    tenantId: string,
    at: Date,
  ): Promise<StoredMotivationScheme | null> {
    const row = await this.prisma.motivationScheme.findFirst({
      where: { tenantId, activeFrom: { lte: at } },
      orderBy: [{ activeFrom: 'desc' }, { version: 'desc' }],
      select: SCHEME_SELECT,
    });
    return row ? toStored(row) : null;
  }

  async resolveAt(
    tenantId: string,
    at: Date,
  ): Promise<ResolvedMotivationScheme> {
    const stored = await this.activeAt(tenantId, at);
    return {
      stored,
      scheme: stored?.scheme ?? (await this.startScheme(tenantId)),
    };
  }

  async versions(tenantId: string): Promise<StoredMotivationScheme[]> {
    const rows = await this.prisma.motivationScheme.findMany({
      where: { tenantId },
      orderBy: { version: 'desc' },
      select: SCHEME_SELECT,
    });
    return rows.map(toStored);
  }

  /** Новая версия действует с момента сохранения. Старые версии не меняются. */
  async save(
    ctx: AuthContext,
    scheme: MotivationScheme,
  ): Promise<StoredMotivationScheme> {
    const row = await this.prisma.$transaction(async (tx) => {
      const last = await tx.motivationScheme.findFirst({
        where: { tenantId: ctx.tenantId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      return tx.motivationScheme.create({
        data: {
          tenantId: ctx.tenantId,
          version: (last?.version ?? 0) + 1,
          params: scheme,
          activeFrom: new Date(),
          createdBy: ctx.userId,
        },
        select: SCHEME_SELECT,
      });
    });
    return toStored(row);
  }
}

function toStored(
  row: Prisma.MotivationSchemeGetPayload<{ select: typeof SCHEME_SELECT }>,
): StoredMotivationScheme {
  return {
    id: row.id,
    version: row.version,
    activeFrom: row.activeFrom,
    createdAt: row.createdAt,
    scheme: row.params as unknown as MotivationScheme,
  };
}
