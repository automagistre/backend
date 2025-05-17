import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class PhoneValidationPipe implements PipeTransform {
  private readonly MIN_PHONE_LENGTH = 11;
  private readonly MAX_PHONE_LENGTH = 15;
  private readonly DEFAULT_COUNTRY_CODE = '7';

  transform(value: any): string {
    if (value === undefined || value === null) {
      throw new BadRequestException('Телефонный номер не должен быть пустым');
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Телефонный номер должен быть строкой');
    }

    const cleanedPhone = this.cleanPhoneNumber(value);
    const formattedPhone = this.formatPhoneNumber(cleanedPhone);

    if (!this.validatePhoneNumber(formattedPhone)) {
      throw new BadRequestException(
        `Неверный формат телефонного номера. Номер должен содержать от ${this.MIN_PHONE_LENGTH} до ${this.MAX_PHONE_LENGTH} цифр`,
      );
    }

    return formattedPhone;
  }

  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private formatPhoneNumber(phone: string): string {
    if (phone.startsWith('8') && phone.length > 1) {
      return `+${this.DEFAULT_COUNTRY_CODE}${phone.substring(1)}`;
    }

    if (!phone.startsWith('+')) {
      return `+${phone}`;
    }

    return phone;
  }

  private validatePhoneNumber(phone: string): boolean {
    const digitsOnly = phone.replace(/\D/g, '');
    return (
      digitsOnly.length >= this.MIN_PHONE_LENGTH &&
      digitsOnly.length <= this.MAX_PHONE_LENGTH
    );
  }
}
