import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { MotivationSchemeModel } from '../models/motivation-scheme.model';
import {
  fromMotivationSchemeInput,
  toMotivationSchemeModel,
} from '../models/motivation-scheme.mapper';
import { MotivationSchemeVersionModel } from '../models/order-motivation.model';
import {
  MotivationSchemeService,
  type StoredMotivationScheme,
} from './motivation-scheme.service';

// TODO(роли): чтение — как у отчёта прибыли, сохранение схемы — только руководителю
@Resolver()
@RequireTenant()
export class MotivationSchemeResolver {
  constructor(private readonly schemes: MotivationSchemeService) {}

  @Query(() => MotivationSchemeModel, {
    description: 'Стартовая схема бонуса с продаж под должности тенанта',
  })
  async motivationDefaultScheme(
    @AuthContext() ctx: AuthContextType,
  ): Promise<MotivationSchemeModel> {
    return toMotivationSchemeModel(
      await this.schemes.startScheme(ctx.tenantId),
    );
  }

  @Query(() => MotivationSchemeVersionModel, {
    nullable: true,
    description: 'Действующая сейчас версия схемы; null — схема не сохранена',
  })
  async motivationActiveScheme(
    @AuthContext() ctx: AuthContextType,
  ): Promise<MotivationSchemeVersionModel | null> {
    const stored = await this.schemes.activeAt(ctx.tenantId, new Date());
    return stored ? toVersionModel(stored) : null;
  }

  @Query(() => [MotivationSchemeVersionModel], {
    description: 'Все версии схемы, новые сверху',
  })
  async motivationSchemeVersions(
    @AuthContext() ctx: AuthContextType,
  ): Promise<MotivationSchemeVersionModel[]> {
    const versions = await this.schemes.versions(ctx.tenantId);
    return versions.map(toVersionModel);
  }

  @Mutation(() => MotivationSchemeVersionModel, {
    description:
      'Сохранить схему новой версией, действует сразу. Начисленное не пересчитывается',
  })
  async saveMotivationScheme(
    @AuthContext() ctx: AuthContextType,
    @Args('scheme', { type: () => MotivationSchemeModel })
    scheme: MotivationSchemeModel,
  ): Promise<MotivationSchemeVersionModel> {
    return toVersionModel(
      await this.schemes.save(ctx, fromMotivationSchemeInput(scheme)),
    );
  }
}

function toVersionModel(
  stored: StoredMotivationScheme,
): MotivationSchemeVersionModel {
  return {
    id: stored.id,
    version: stored.version,
    activeFrom: stored.activeFrom,
    createdAt: stored.createdAt,
    scheme: toMotivationSchemeModel(stored.scheme),
  };
}
