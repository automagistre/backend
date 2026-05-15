-- Разделяем CustomerTransactionSource.OrderSalary (=4) и OrderPrepayRefund (=12).
-- До этой миграции OrderPrepayRefund был алиасом OrderSalary (оба = 4), из-за чего
-- идемпотентная проверка в SalaryService.chargeByOrder ложно срабатывала на запись
-- возврата предоплаты и блокировала начисление зарплаты по закрытому заказу.
--
-- Признак для миграции: source=4 и amount_amount<0. ЗП по заказу всегда положительная
-- (см. SalaryService.chargeByOrder: if (amount <= 0n) continue), возврат предоплаты —
-- всегда отрицательный (см. OrderService.closeOrder: OrderPrepayRefund берётся, когда
-- amount < 0n).

UPDATE customer_transaction
SET source = 12
WHERE source = 4
  AND amount_amount < 0;
