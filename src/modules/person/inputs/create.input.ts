import { UsePipes } from '@nestjs/common';
import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEmail, IsPhoneNumber, IsUUID, ValidateIf } from 'class-validator';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';

@InputType()
export class CreatePersonInput {
  @ValidateIf((o) => !o.lastname)
  @Field(() => String, { nullable: true, description: 'Имя' })
  firstname?: string | null;

  @ValidateIf((o) => !o.firstname)
  @Field(() => String, { nullable: true, description: 'Фамилия' })
  lastname?: string | null;

  @IsPhoneNumber()
  @Field(() => PhoneNumberScalar, { nullable: true, description: 'Телефон' })
  telephone?: string | null;

  @IsPhoneNumber()
  @Field(() => PhoneNumberScalar, { nullable: true, description: 'Телефон офиса' })
  officePhone?: string | null;

  @IsEmail()
  @Field(() => String, { nullable: true, description: 'Email' })
  email?: string | null;

  @Field(() => Boolean, { description: 'Поставщик', defaultValue: false })
  contractor: boolean;

  @Field(() => Boolean, { description: 'Продавец', defaultValue: false })
  seller: boolean;

  @IsUUID()
  @Field(() => ID)
  tenantGroupId: string;
}
