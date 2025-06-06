import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { BadRequestException } from '@nestjs/common';

@Scalar('VIN')
export class VINScalar implements CustomScalar<string, string> {
  description =
    'Идентификационный номер транспортного средства (17 буквенно-цифровых символов, исключая I, O, Q)';

  private readonly VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;
  private readonly FORBIDDEN_LETTERS = ['I', 'O', 'Q'];

  parseValue(value: string): string {
    return this.validateAndFormatVIN(value);
  }

  serialize(value: string): string {
    return value; // Уже отформатировано при сохранении
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new BadRequestException('VIN must be a string');
    }
    return this.validateAndFormatVIN(ast.value);
  }

  private validateAndFormatVIN(vin: string): string {
    if (typeof vin !== 'string') {
      throw new BadRequestException('VIN должен быть строкой');
    }

    // Удаляем все пробелы и неалфавитные символы
    const cleanedVin = vin.trim().replace(/\s+/g, '').toUpperCase();

    // Проверка длины
    if (cleanedVin.length !== 17) {
      throw new BadRequestException(
        `VIN должен содержать ровно 17 символов, получено ${cleanedVin.length}`,
      );
    }

    // Проверка на запрещенные символы
    const containsForbiddenChars = this.FORBIDDEN_LETTERS.some((char) =>
      cleanedVin.includes(char),
    );
    
    if (containsForbiddenChars) {
      throw new BadRequestException(
        `VIN не может содержать буквы I, O или Q. Получено: ${vin}`,
      );
    }

    // Проверка по регулярному выражению
    if (!this.VIN_REGEX.test(cleanedVin)) {
      throw new BadRequestException(
        'VIN содержит недопустимые символы. Допустимы только буквы (кроме I, O, Q) и цифры',
      );
    }

    return cleanedVin;
  }
}
