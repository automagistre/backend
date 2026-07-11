import { registerEnumType } from '@nestjs/graphql';

/** Вид работы: своя (автосервис) или подрядная. */
export enum OrderItemServiceKind {
  AUTOSERVICE = 'AUTOSERVICE',
  CONTRACTOR = 'CONTRACTOR',
}

registerEnumType(OrderItemServiceKind, {
  name: 'OrderItemServiceKind',
  description: 'Вид работы: автосервис или подрядчик',
  valuesMap: {
    AUTOSERVICE: { description: 'Работа выполняется сотрудником автосервиса' },
    CONTRACTOR: { description: 'Работа выполняется подрядчиком' },
  },
});
