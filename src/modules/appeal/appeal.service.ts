import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v6 as uuidv6 } from 'uuid';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppealType } from './enums/appeal-type.enum';
import type { AppealModel } from './models/appeal.model';
import type { AppealDetailModel } from './models/appeal-detail.model';
import type { AuthContext } from 'src/common/user-id.store';

interface AppealViewRow {
  id: string;
  tenant_id: string;
  name: string;
  type: number;
  phone: string | null;
  email: string | null;
  status: number;
  created_at: Date;
}

@Injectable()
export class AppealService {
  constructor(private readonly prisma: PrismaService) {}

  async listAppeals(ctx: AuthContext, take = 25, skip = 0): Promise<{ items: AppealModel[]; total: number }> {
    const { tenantId } = ctx;
    
    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<AppealViewRow[]>(
        Prisma.sql`
          SELECT id, tenant_id, name, type, phone, email, status, created_at
          FROM appeal_view
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
          LIMIT ${take}
          OFFSET ${skip}
        `,
      ),
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`
          SELECT COUNT(*) as count
          FROM appeal_view
          WHERE tenant_id = ${tenantId}
        `,
      ),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    const appeals: AppealModel[] = [];

    for (const row of rows) {
      let personFullName: string | null = null;
      if (row.phone) {
        const person = await this.prisma.person.findFirst({
          where: {
            OR: [{ telephone: row.phone }, { officePhone: row.phone }],
          },
        });
        if (person) {
          personFullName = [person.firstname, person.lastname]
            .filter(Boolean)
            .join(' ')
            .trim() || null;
        }
      }

      appeals.push({
        id: row.id,
        name: row.name || '',
        type: row.type,
        phone: row.phone,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        personFullName,
      });
    }

    return { items: appeals, total };
  }

  async getAppealDetail(ctx: AuthContext, id: string, type: number): Promise<AppealDetailModel> {
    const { tenantId } = ctx;

    const statusRecord = await this.prisma.appealStatusRecord.findFirst({
      where: { appealId: id, tenantId },
      orderBy: { id: 'desc' },
    });
    const status = statusRecord?.status ?? 1;

    let base: { id: string; createdAt: Date | null };
    let detail: Partial<AppealDetailModel> = { id, type, status };

    switch (type) {
      case AppealType.CALCULATOR: {
        const row = await this.prisma.appealCalculator.findFirst({
          where: { id, tenantId },
        });
        if (!row) throw new NotFoundException('Appeal not found');
        base = row;
        detail = {
          ...detail,
          name: row.name,
          phone: row.phone,
          note: row.note,
          date: row.date,
          equipmentId: row.equipmentId,
          mileage: row.mileage,
          total: row.total,
          works: row.works as unknown,
        };
        break;
      }
      case AppealType.CALL: {
        const row = await this.prisma.appealCall.findFirst({
          where: { id, tenantId },
        });
        if (!row) throw new NotFoundException('Appeal not found');
        base = row;
        detail = { ...detail, phone: row.phone };
        break;
      }
      case AppealType.COOPERATION: {
        const row = await this.prisma.appealCooperation.findFirst({
          where: { id, tenantId },
        });
        if (!row) throw new NotFoundException('Appeal not found');
        base = row;
        detail = { ...detail, name: row.name, phone: row.phone };
        break;
      }
      case AppealType.QUESTION: {
        const row = await this.prisma.appealQuestion.findFirst({
          where: { id, tenantId },
        });
        if (!row) throw new NotFoundException('Appeal not found');
        base = row;
        detail = {
          ...detail,
          name: row.name,
          email: row.email,
          question: row.question,
        };
        break;
      }
      case AppealType.SCHEDULE: {
        const row = await this.prisma.appealSchedule.findFirst({
          where: { id, tenantId },
        });
        if (!row) throw new NotFoundException('Appeal not found');
        base = row;
        detail = {
          ...detail,
          name: row.name,
          phone: row.phone,
          date: row.date,
        };
        break;
      }
      case AppealType.TIRE_FITTING: {
        const row = await this.prisma.appealTireFitting.findFirst({
          where: { id, tenantId },
        });
        if (!row) throw new NotFoundException('Appeal not found');
        base = row;
        detail = {
          ...detail,
          name: row.name,
          phone: row.phone,
          modelId: row.modelId,
          category: row.category,
          diameter: row.diameter,
          total: row.total,
          works: row.works as unknown,
        };
        break;
      }
      default:
        throw new NotFoundException('Invalid appeal type');
    }

    return {
      id: detail.id!,
      type: detail.type!,
      status: detail.status!,
      createdAt: base.createdAt ?? new Date(),
      name: detail.name ?? null,
      phone: detail.phone ?? null,
      email: detail.email ?? null,
      question: detail.question ?? null,
      note: detail.note ?? null,
      date: detail.date ?? null,
      equipmentId: detail.equipmentId ?? null,
      mileage: detail.mileage ?? null,
      total: detail.total ?? null,
      works: detail.works ?? null,
      modelId: detail.modelId ?? null,
      category: detail.category ?? null,
      diameter: detail.diameter ?? null,
    };
  }

  async updateAppealStatus(ctx: AuthContext, appealId: string, status: number): Promise<void> {
    const { tenantId } = ctx;

    const latest = await this.prisma.appealStatusRecord.findFirst({
      where: { appealId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const currentStatus = latest?.status ?? 1;
    if (currentStatus === status) {
      throw new BadRequestException('Статус уже установлен');
    }

    await this.prisma.appealStatusRecord.create({
      data: { id: uuidv6(), appealId, status, tenantId },
    });
  }

  async appealOpenCount(ctx: AuthContext): Promise<number> {
    const { tenantId } = ctx;
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*) as count
        FROM appeal_view
        WHERE tenant_id = ${tenantId} AND status != 4
      `,
    );
    return Number(result[0]?.count ?? 0);
  }
}
