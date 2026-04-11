import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhoneValidationPipe } from 'src/common/pipes/phone-validation.pipe';
import type { AuthContext } from 'src/common/user-id.store';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CallRoutingBindingFilterInput } from './inputs/call-routing-binding-filter.input';
import { CreateCallRoutingBindingInput } from './inputs/create-call-routing-binding.input';
import { UpdateCallRoutingBindingInput } from './inputs/update-call-routing-binding.input';
import { CallRoutingBindingModel } from './models/call-routing-binding.model';

const DEFAULT_OPERATOR = 'uis';

@Injectable()
export class CallRoutingBindingsService {
  private readonly phoneValidationPipe = new PhoneValidationPipe();

  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: AuthContext,
    take = 25,
    skip = 0,
    filter?: CallRoutingBindingFilterInput,
  ): Promise<{ items: CallRoutingBindingModel[]; total: number }> {
    const where: Prisma.CallRoutingBindingWhereInput = {
      tenantId: ctx.tenantId,
    };

    if (filter?.operator?.trim()) {
      where.operator = this.normalizeOperator(filter.operator);
    }

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.search?.trim()) {
      const search = filter.search.trim();
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { lineExternalId: { contains: search, mode: 'insensitive' } },
        { virtualPhone: { contains: search, mode: 'insensitive' } },
        { webhookToken: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.callRoutingBinding.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.callRoutingBinding.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toModel(item)),
      total,
    };
  }

  async create(
    ctx: AuthContext,
    input: CreateCallRoutingBindingInput,
  ): Promise<CallRoutingBindingModel> {
    const operator = this.normalizeOperator(input.operator);
    const lineExternalId = this.normalizeOptionalRoutingKey(
      input.lineExternalId,
    );
    const virtualPhone = this.normalizeOptionalVirtualPhone(input.virtualPhone);
    const webhookToken = this.normalizeRequiredWebhookToken(input.webhookToken);
    const displayName = this.normalizeOptionalDisplayName(input.displayName);

    this.assertHasRoutingKey(lineExternalId, virtualPhone);
    await this.assertUniqueRoutingKeys(operator, lineExternalId, virtualPhone);

    const created = await this.prisma.callRoutingBinding.create({
      data: {
        operator,
        lineExternalId,
        virtualPhone,
        webhookToken,
        tenantId: ctx.tenantId,
        tenantGroupId: ctx.tenantGroupId,
        displayName,
        isActive: input.isActive ?? true,
        createdBy: ctx.userId,
      },
    });

    return this.toModel(created);
  }

  async update(
    ctx: AuthContext,
    input: UpdateCallRoutingBindingInput,
  ): Promise<CallRoutingBindingModel> {
    const existing = await this.prisma.callRoutingBinding.findFirst({
      where: {
        id: input.id,
        tenantId: ctx.tenantId,
      },
    });
    if (!existing) {
      throw new NotFoundException('Маршрут звонков не найден');
    }

    const operator =
      input.operator !== undefined
        ? this.normalizeOperator(input.operator)
        : existing.operator;
    const lineExternalId =
      input.lineExternalId !== undefined
        ? this.normalizeOptionalRoutingKey(input.lineExternalId)
        : existing.lineExternalId;
    const virtualPhone =
      input.virtualPhone !== undefined
        ? this.normalizeOptionalVirtualPhone(input.virtualPhone)
        : existing.virtualPhone;
    const webhookToken =
      input.webhookToken !== undefined
        ? this.normalizeRequiredWebhookToken(input.webhookToken)
        : existing.webhookToken;
    const displayName =
      input.displayName !== undefined
        ? this.normalizeOptionalDisplayName(input.displayName)
        : existing.displayName;

    this.assertHasRoutingKey(lineExternalId, virtualPhone);
    await this.assertUniqueRoutingKeys(
      operator,
      lineExternalId,
      virtualPhone,
      existing.id,
    );

    const updated = await this.prisma.callRoutingBinding.update({
      where: { id: existing.id },
      data: {
        operator,
        lineExternalId,
        virtualPhone,
        webhookToken,
        displayName,
        isActive: input.isActive ?? existing.isActive,
      },
    });

    return this.toModel(updated);
  }

  async remove(ctx: AuthContext, id: string): Promise<CallRoutingBindingModel> {
    const existing = await this.prisma.callRoutingBinding.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
      },
    });
    if (!existing) {
      throw new NotFoundException('Маршрут звонков не найден');
    }

    const deleted = await this.prisma.callRoutingBinding.delete({
      where: { id: existing.id },
    });
    return this.toModel(deleted);
  }

  private normalizeOperator(value?: string | null): string {
    const normalized = value?.trim().toLowerCase() || DEFAULT_OPERATOR;
    if (!normalized) {
      throw new BadRequestException('Оператор не может быть пустым');
    }
    if (normalized.length > 32) {
      throw new BadRequestException('Оператор слишком длинный');
    }
    return normalized;
  }

  private normalizeOptionalRoutingKey(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeOptionalVirtualPhone(value?: string | null): string | null {
    const normalized = this.normalizeOptionalRoutingKey(value);
    if (!normalized) {
      return null;
    }
    return this.phoneValidationPipe.transform(normalized);
  }

  private normalizeRequiredWebhookToken(value?: string | null): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException('Webhook token обязателен');
    }
    if (normalized.length < 8) {
      throw new BadRequestException(
        'Webhook token должен быть не короче 8 символов',
      );
    }
    return normalized;
  }

  private normalizeOptionalDisplayName(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private assertHasRoutingKey(
    lineExternalId: string | null,
    virtualPhone: string | null,
  ): void {
    if (!lineExternalId && !virtualPhone) {
      throw new BadRequestException(
        'Укажите virtualPhone или lineExternalId для маршрутизации',
      );
    }
  }

  private async assertUniqueRoutingKeys(
    operator: string,
    lineExternalId: string | null,
    virtualPhone: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (lineExternalId) {
      const lineConflict = await this.prisma.callRoutingBinding.findFirst({
        where: {
          operator,
          lineExternalId,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (lineConflict) {
        throw new ConflictException(
          'Маршрут с таким lineExternalId уже существует',
        );
      }
    }

    if (virtualPhone) {
      const phoneConflict = await this.prisma.callRoutingBinding.findFirst({
        where: {
          operator,
          virtualPhone,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (phoneConflict) {
        throw new ConflictException(
          'Маршрут с таким virtualPhone уже существует',
        );
      }
    }
  }

  private toModel(
    item: Prisma.CallRoutingBindingGetPayload<Record<string, never>>,
  ): CallRoutingBindingModel {
    return {
      id: item.id,
      operator: item.operator,
      lineExternalId: item.lineExternalId,
      virtualPhone: item.virtualPhone,
      webhookToken: item.webhookToken,
      displayName: item.displayName,
      isActive: item.isActive,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
    };
  }
}
