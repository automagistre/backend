import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { BadRequestException } from '@nestjs/common';

@Scalar('GosNomerRU')
export class GosNomerRUScalar implements CustomScalar<string, string> {
  description = 'Российский государственный номер автомобиля';

  // Допустимые буквы в госномере РФ (те, которые есть как в кириллице, так и в латинице)
  private readonly ALLOWED_LETTERS = [
    'А',
    'В',
    'Е',
    'К',
    'М',
    'Н',
    'О',
    'Р',
    'С',
    'Т',
    'У',
    'Х',
  ];

  // Регулярное выражение для проверки госномера (формат: A000AA | регион)
  private readonly GOSNOMER_REGEX =
    /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;

  parseValue(value: string): string {
    return this.validateAndFormatGosNomer(value);
  }

  serialize(value: string): string {
    return value; // Уже отформатировано при сохранении
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new BadRequestException('Госномер должен быть строкой');
    }
    return this.validateAndFormatGosNomer(ast.value);
  }

  private validateAndFormatGosNomer(gosnomer: string): string {
    if (typeof gosnomer !== 'string') {
      throw new BadRequestException('Госномер должен быть строкой');
    }

    // Преобразование латинских букв в кириллицу и перевод в верхний регистр
    const latinToCyrillic = {
      A: 'А',
      B: 'В',
      E: 'Е',
      K: 'К',
      M: 'М',
      H: 'Н',
      O: 'О',
      P: 'Р',
      C: 'С',
      T: 'Т',
      Y: 'У',
      X: 'Х',
    };

    const formattedGosNomer = gosnomer
      .toUpperCase()
      .replace(/[^A-ZА-Я0-9]/g, '') // Удаляем все, кроме букв и цифр
      .split('')
      .map((char) => latinToCyrillic[char] || char)
      .join('');

    // Проверка правильности формата
    if (!this.GOSNOMER_REGEX.test(formattedGosNomer)) {
      throw new BadRequestException(
        'Неверный формат госномера. Пример: А123ВС77',
      );
    }

    // Проверка, что все буквы допустимы
    const letters = formattedGosNomer.replace(/[0-9]/g, '').split('');
    const hasInvalidLetters = letters.some(
      (letter) => !this.ALLOWED_LETTERS.includes(letter),
    );

    if (hasInvalidLetters) {
      throw new BadRequestException(
        `Госномер содержит недопустимые буквы. Допустимы только: ${this.ALLOWED_LETTERS.join(', ')}`,
      );
    }

    return formattedGosNomer;
  }
}
