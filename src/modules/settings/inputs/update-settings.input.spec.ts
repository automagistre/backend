import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSettingsInput } from './update-settings.input';

async function invalidFields(
  plain: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateSettingsInput, plain));
  return errors.map((error) => error.property);
}

describe('UpdateSettingsInput: новые ключи', () => {
  it('допустимые значения проходят', async () => {
    await expect(
      invalidFields({
        slotMinutes: 15,
        orderDeleteCoolingHours: 0,
        discountRoundStep: 0,
        tireStorageMonths: 12,
        tireStorageDefaultQuantity: 2,
        taskOverdueHours: 48,
      }),
    ).resolves.toEqual([]);
  });

  it('значения вне списка или диапазона отклоняются', async () => {
    await expect(
      invalidFields({
        slotMinutes: 25,
        orderDeleteCoolingHours: 73,
        discountRoundStep: 3000,
        tireStorageMonths: 0,
        tireStorageDefaultQuantity: 13,
        taskOverdueHours: 0,
      }),
    ).resolves.toEqual([
      'slotMinutes',
      'orderDeleteCoolingHours',
      'discountRoundStep',
      'tireStorageMonths',
      'tireStorageDefaultQuantity',
      'taskOverdueHours',
    ]);
  });
});
