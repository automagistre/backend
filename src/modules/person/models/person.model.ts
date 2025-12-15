import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Person } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';


@ObjectType()
export class PersonModel implements Person {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  firstname: string | null;

  @Field(() => String, { nullable: true })
  lastname: string | null;

  @Field(() => PhoneNumberScalar, { nullable: true })
  telephone: string | null;

  @Field(() => PhoneNumberScalar, { nullable: true })
  officePhone: string | null;

  @Field(() => String, { nullable: true })
  email: string | null;

  @Field(() => Boolean)
  contractor: boolean;

  @Field(() => Boolean)
  seller: boolean;

  @Field(() => ID)
  tenantGroupId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;

  @Field(() => Int)
  balance: Decimal;
}
