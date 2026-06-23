import { Module } from '@nestjs/common';
import { CustomerCarRelationModule } from 'src/modules/customer-car-relation/customer-car-relation.module';
import { OrderModule } from 'src/modules/order/order.module';
import { PersonModule } from 'src/modules/person/person.module';
import { RecommendationModule } from 'src/modules/recommendation/recommendation.module';
import { MeResolver } from './me.resolver';

/**
 * Клиентский endpoint (используют LK BFF / другие сервисы).
 * Все операции с префиксом `me*`. Аналогично WwwModule —
 * tenant определяется по `X-Tenant-Public-Id`.
 *
 * Бизнес-логика делегируется в существующие сервисы:
 * - PersonService — профиль (CRUD)
 * - CustomerCarRelationService — машины клиента
 * - OrderService — заказы клиента (read-only)
 * - RecommendationService — активные рекомендации (read-only)
 */
@Module({
  imports: [
    PersonModule,
    CustomerCarRelationModule,
    OrderModule,
    RecommendationModule,
  ],
  providers: [MeResolver],
})
export class MeModule {}
