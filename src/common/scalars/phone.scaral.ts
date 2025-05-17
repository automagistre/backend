import { Scalar, CustomScalar } from '@nestjs/graphql';
import { GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { PhoneValidationPipe } from '../pipes/phone-validation.pipe';


@Scalar('PhoneNumber')
export class PhoneNumberScalar implements CustomScalar<string, string> {
  description = 'Телефонный номер в формате +7XXX...';

  parseValue(value: string): string {
    return new PhoneValidationPipe().transform(value);
  }

  serialize(value: string): string {
    return value; // Возвращаем как есть (уже отформатировано)
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING) {
      return new PhoneValidationPipe().transform(ast.value);
    }
    return '';
  }
}
