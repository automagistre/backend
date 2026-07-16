import { registerEnumType } from '@nestjs/graphql';

export enum TireStorageStatus {
  ENTERED = 'ENTERED',
  IN_WAREHOUSE = 'IN_WAREHOUSE',
  AWAITING_SHOP = 'AWAITING_SHOP',
  IN_SHOP = 'IN_SHOP',
  CLOSED = 'CLOSED',
  DISPOSED = 'DISPOSED',
}

registerEnumType(TireStorageStatus, {
  name: 'TireStorageStatus',
  description: 'Статус договора хранения шин',
  valuesMap: {
    ENTERED: { description: 'Введён, не оплачен' },
    IN_WAREHOUSE: { description: 'На складе (оплачен, действует)' },
    AWAITING_SHOP: { description: 'К выдаче (ожидает перемещения в цех)' },
    IN_SHOP: { description: 'В цехе, готов к установке' },
    CLOSED: { description: 'Закрыт (договор завершён)' },
    DISPOSED: { description: 'Утилизирован (невостребован)' },
  },
});
