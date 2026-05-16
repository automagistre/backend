import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Args,
  Context,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import type { AuthContext } from 'src/common/user-id.store';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { PersonService } from 'src/modules/person/person.service';
import {
  WwwTenant,
  WwwTenantContext,
} from 'src/modules/www/decorators/www-tenant.decorator';
import { MeProfileUpdateInput } from './inputs/me-profile-update.input';
import { MePerson, toMePerson } from './models/me-person.model';

interface ReqWithHeaders {
  headers?: Record<string, string | string[] | undefined>;
}

const ME_PHONE_HEADER = 'x-me-customer-phone';

/**
 * Клиентский endpoint (LK BFF, www-фронт и пр.). Все операции — с префиксом `me*`.
 *
 * Идентификация текущего клиента — через header `X-Me-Customer-Phone` (mock).
 * Когда появится auth-flow клиента (Keycloak realm LK), header заменится на
 * связку `keycloakUserId ↔ Person.id`, идентификация будет через JWT клиента.
 *
 * Tenant определяется по `X-Tenant-Public-Id` (как в WwwResolver).
 *
 * NB: query называется `meProfile`, а не `me`, потому что `me` уже занят
 * админским резолвером (`auth/me.resolver.ts`) в той же схеме `/api/v1/graphql`.
 *
 * Все CRUD-операции делегируются в `PersonService` — отдельного сервиса под
 * клиентский слой не вводим, чтобы не дублировать бизнес-логику Person.
 */
@Public()
@Resolver()
export class MeResolver {
  constructor(private readonly personService: PersonService) {}

  @Query(() => MePerson, {
    name: 'meProfile',
    description:
      'Профиль текущего клиента. Идентификация через X-Me-Customer-Phone (mock; позже — JWT клиента).',
  })
  async meProfile(
    @WwwTenant() tenant: WwwTenantContext,
    @Context('req') req: ReqWithHeaders,
  ): Promise<MePerson> {
    const personId = await this.identifyPersonId(tenant, req);
    const person = await this.personService.findOne(
      this.buildCtx(personId, tenant),
      personId,
    );
    if (!person) {
      throw new NotFoundException('Клиент не найден');
    }
    return toMePerson(person);
  }

  @Mutation(() => MePerson, {
    name: 'meProfileUpdate',
    description:
      'Partial-update профиля текущего клиента. Основной телефон (identity) править нельзя — обращение в автосервис.',
  })
  async meProfileUpdate(
    @WwwTenant() tenant: WwwTenantContext,
    @Context('req') req: ReqWithHeaders,
    @Args('input') input: MeProfileUpdateInput,
  ): Promise<MePerson> {
    const personId = await this.identifyPersonId(tenant, req);
    const updated = await this.personService.update(
      this.buildCtx(personId, tenant),
      {
        id: personId,
        ...(input.firstname !== undefined && { firstname: input.firstname }),
        ...(input.lastname !== undefined && { lastname: input.lastname }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.officePhone !== undefined && {
          officePhone: input.officePhone,
        }),
      },
    );
    return toMePerson(updated);
  }

  /**
   * По телефону из header находит ровно одного Person в tenant group.
   * 0 совпадений → 404, >1 → 409 (не выдаём чужие данные).
   */
  private async identifyPersonId(
    tenant: WwwTenantContext,
    req: ReqWithHeaders,
  ): Promise<string> {
    const phone = this.requirePhone(req);
    const candidates = phoneCandidates(phone);
    if (candidates.length === 0) {
      throw new ForbiddenException('Невалидный телефон в идентификации');
    }

    const matches = await this.personService.findByPhonesInTenantGroup(
      tenant.tenantGroupId,
      candidates,
      2,
    );
    if (matches.length === 0) {
      throw new NotFoundException(
        `Клиент по телефону ${phone} не найден в tenant group`,
      );
    }
    if (matches.length > 1) {
      throw new ConflictException(
        'По этому телефону найдено несколько клиентов — обратитесь в автосервис',
      );
    }
    return matches[0].id;
  }

  /**
   * AuthContext для PersonService. `userId = personId` — клиент действует
   * сам от своего имени (а не от лица staff). После Keycloak realm LK
   * `userId` станет keycloakUserId, связанный с Person.id через identity-mapping.
   */
  private buildCtx(personId: string, tenant: WwwTenantContext): AuthContext {
    return {
      userId: personId,
      tenantId: tenant.tenantId,
      tenantGroupId: tenant.tenantGroupId,
    };
  }

  private requirePhone(req: ReqWithHeaders): string {
    const raw = req.headers?.[ME_PHONE_HEADER];
    const phone = Array.isArray(raw) ? raw[0] : raw;
    if (!phone) {
      throw new ForbiddenException(
        `Идентификация клиента не задана: укажите header ${ME_PHONE_HEADER}`,
      );
    }
    return phone;
  }
}

/**
 * Возвращает варианты RU-телефона для точного `in`-поиска
 * (`findByPhonesInTenantGroup` сравнивает строки точно).
 */
function phoneCandidates(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  let core: string | null = null;
  if (digits.length === 11 && digits[0] === '7') core = digits;
  else if (digits.length === 11 && digits[0] === '8') core = '7' + digits.slice(1);
  else if (digits.length === 10) core = '7' + digits;

  if (!core) return [];
  return [`+${core}`, core, `8${core.slice(1)}`];
}
