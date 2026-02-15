import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { McPartLineInput } from './mc-part-line.input';

@InputType({ description: 'Строка карты ТО (работа + запчасти)' })
export class McLineInput {
  @IsUUID()
  @Field(() => String, { description: 'ID работы' })
  workId: string;

  @IsInt()
  @Min(1)
  @Field(() => Int, { description: 'Период в тыс. км' })
  period: number;

  @IsBoolean()
  @Field(() => Boolean, { description: 'Рекомендуемая' })
  recommended: boolean;

  @IsInt()
  @Min(0)
  @Field(() => Int, { description: 'Порядок' })
  position: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McPartLineInput)
  @Field(() => [McPartLineInput], { description: 'Запчасти', defaultValue: [] })
  parts: McPartLineInput[];
}
