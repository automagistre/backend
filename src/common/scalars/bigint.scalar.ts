import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('BigInt', () => BigInt)
export class BigIntScalar implements CustomScalar<string, bigint> {
  description = 'BigInt custom scalar type';

  parseValue(value: string): bigint {
    return BigInt(value); // Convert from client input
  }

  serialize(value: bigint): string {
    return value.toString(); // Convert to client output
  }

  parseLiteral(ast: ValueNode): bigint {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      return BigInt(ast.value);
    }
    return BigInt(0);
  }
}
