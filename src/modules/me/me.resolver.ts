import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import {
  WwwTenant,
  WwwTenantContext,
} from 'src/modules/www/decorators/www-tenant.decorator';
import { MeService } from './me.service';
import { MePerson } from './models/me-person.model';

interface ReqWithHeaders {
  headers?: Record<string, string | string[] | undefined>;
}

const ME_PHONE_HEADER = 'x-my-customer-phone';

/**
 * Клиентский endpoint (LK BFF, www-фронт и пр.). Все queries — с префиксом `my*`.
 *
 * Идентификация текущего клиента — через header `X-My-Customer-Phone` (mock).
 * Когда появится auth-flow клиента (Keycloak realm LK), header заменится на JWT
 * (или останется как доп. proxy-header при service-account вызовах).
 *
 * Tenant определяется по `X-Tenant-Public-Id` (как в WwwResolver).
 *
 * NB: query называется `myProfile`, а не `me`, потому что `me` уже занят
 * админским резолвером (`auth/me.resolver.ts`) в той же схеме `/api/v1/graphql`.
 */
@Public()
@Resolver()
export class MeResolver {
  constructor(private readonly me: MeService) {}

  @Query(() => MePerson, {
    name: 'myProfile',
    description:
      'Профиль текущего клиента. Идентификация через X-My-Customer-Phone (mock; позже — JWT клиента).',
  })
  async myProfile(
    @WwwTenant() ctx: WwwTenantContext,
    @Context('req') req: ReqWithHeaders,
  ): Promise<MePerson> {
    const phone = this.extractPhone(req);
    if (!phone) {
      throw new ForbiddenException(
        `Идентификация клиента не задана: укажите header ${ME_PHONE_HEADER}`,
      );
    }

    const person = await this.me.findPersonByPhone(ctx.tenantGroupId, phone);
    if (!person) {
      throw new NotFoundException(
        `Клиент по телефону ${phone} не найден в tenant group`,
      );
    }

    return person;
  }

  private extractPhone(req: ReqWithHeaders): string | null {
    const raw = req.headers?.[ME_PHONE_HEADER];
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  }
}
