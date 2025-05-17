import { Field, ID, InputType } from "@nestjs/graphql";
import { IsEmail, IsPhoneNumber, IsUUID, ValidateIf } from "class-validator";

@InputType()
export class CreatePersonInput {
  @ValidateIf(o => !o.lastname)
  @Field(() => String, { nullable: true, description: 'Имя' })
  firstname?: string | null;

  @ValidateIf(o => !o.firstname)
  @Field(() => String, { nullable: true, description: 'Фамилия' })
  lastname?: string | null;

  @IsPhoneNumber()
  @Field(() => String, { nullable: true, description: 'Телефон' })
  telephone?: string | null;

  @IsPhoneNumber()
  @Field(() => String, { nullable: true, description: 'Телефон офиса' })
  officePhone?: string | null;

  @IsEmail()
  @Field(() => String, { nullable: true, description: 'Email' })
  email?: string | null;

  @Field(() => Boolean, { description: 'Поставщик' })
  contractor: boolean;

  @Field(() => Boolean, { description: 'Продавец' })
  seller: boolean;

  @IsUUID()
  @Field(() => ID, { description: '1ec13d33-3f41-6cf0-b012-02420a000f18' })
  tenantGroupId: string;
}
