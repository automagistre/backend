import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { AuthContext } from 'src/common/user-id.store';
// TODO(lk-auth): временно отключён публичный доступ к me*-эндпоинтам.
// Вернуть @Public() (или ввести LkTenantGuard с service-account JWT) при
// возобновлении задачи LK. См. agent-core-lk-auth-hardening.
// import { Public } from 'src/modules/auth/decorators/public.decorator';
import { CustomerCarRelationService } from 'src/modules/customer-car-relation/customer-car-relation.service';
import { OrderService } from 'src/modules/order/order.service';
import { PersonService } from 'src/modules/person/person.service';
import { RecommendationService } from 'src/modules/recommendation/recommendation.service';
import {
  WwwTenant,
  WwwTenantContext,
} from 'src/modules/www/decorators/www-tenant.decorator';
import { MeProfileUpdateInput } from './inputs/me-profile-update.input';
import { MeCar, toMeCar } from './models/me-car.model';
import {
  MeOrderList,
  MeOrdersArgs,
  toMeOrder,
} from './models/me-order.model';
import { MePerson, toMePerson } from './models/me-person.model';
import {
  MeRecommendation,
  toMeRecommendation,
} from './models/me-recommendation.model';

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
 * Tenant определяется по `X-Tenant-Public-Id` (как в WwwResolver). Person/Car/Order
 * фильтруются по `tenantGroupId` — клиент видит свои данные во всей tenant group.
 *
 * NB: query называется `meProfile`, а не `me`, потому что `me` уже занят
 * админским резолвером (`auth/me.resolver.ts`) в той же схеме `/api/v1/graphql`.
 *
 * Все CRUD-операции делегируются в существующие сервисы (PersonService, OrderService,
 * CustomerCarRelationService) — отдельных «клиентских» сервисов не вводим.
 */
// @Public() — временно отключён (см. TODO(lk-auth) выше)
@Resolver(() => MePerson)
export class MeResolver {
  constructor(
    private readonly personService: PersonService,
    private readonly carRelations: CustomerCarRelationService,
    private readonly orderService: OrderService,
    private readonly recommendationService: RecommendationService,
  ) {}

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
   * Машины клиента — все уникальные авто из его Order'ов в рамках tenant group.
   */
  @ResolveField(() => [MeCar], {
    description: 'Автомобили клиента (по истории заказов в tenant group)',
  })
  async cars(
    @Parent() person: MePerson,
    @WwwTenant() tenant: WwwTenantContext,
  ): Promise<MeCar[]> {
    const cars = await this.carRelations.findCarsByCustomerInTenantGroup(
      tenant.tenantGroupId,
      person.id,
    );
    return cars.map(toMeCar);
  }

  @Query(() => MeOrderList, {
    name: 'meOrders',
    description:
      'Заказы клиента по конкретной машине, с пагинацией и фильтром «closed».',
  })
  async meOrders(
    @WwwTenant() tenant: WwwTenantContext,
    @Context('req') req: ReqWithHeaders,
    @Args() args: MeOrdersArgs,
  ): Promise<MeOrderList> {
    const personId = await this.identifyPersonId(tenant, req);
    await this.assertCarOwned(tenant.tenantGroupId, personId, args.carId);

    const { items, total } =
      await this.orderService.findManyByCustomerInTenantGroup(
        tenant.tenantGroupId,
        personId,
        {
          take: args.take,
          skip: args.skip,
          closed: args.closed ?? undefined,
          carId: args.carId,
        },
      );
    return { items: items.map(toMeOrder), total };
  }

  @Query(() => [MeRecommendation], {
    name: 'meRecommendations',
    description:
      'Активные рекомендации по конкретной машине клиента (expiredAt is null OR > now()).',
  })
  async meRecommendations(
    @WwwTenant() tenant: WwwTenantContext,
    @Context('req') req: ReqWithHeaders,
    @Args('carId', { type: () => ID }) carId: string,
  ): Promise<MeRecommendation[]> {
    const personId = await this.identifyPersonId(tenant, req);
    await this.assertCarOwned(tenant.tenantGroupId, personId, carId);

    const rows =
      await this.recommendationService.findActiveByCarIdInTenantGroup(
        tenant.tenantGroupId,
        carId,
      );
    return rows.map(toMeRecommendation);
  }

  /**
   * Проверка ownership: машина принадлежит клиенту, если есть хотя бы один
   * заказ клиента с этим `carId` в tenant group. Иначе выдадим 404 (а не
   * 403, чтобы не палить существование чужих машин).
   */
  private async assertCarOwned(
    tenantGroupId: string,
    personId: string,
    carId: string,
  ): Promise<void> {
    const cars = await this.carRelations.findCarsByCustomerInTenantGroup(
      tenantGroupId,
      personId,
    );
    const owned = cars.some((c) => c.id === carId);
    if (!owned) {
      throw new NotFoundException('Машина не найдена');
    }
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
