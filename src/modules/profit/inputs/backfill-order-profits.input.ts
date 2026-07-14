import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@InputType()
export class BackfillOrderProfitsInput {
  @Field(() => Int, {
    nullable: true,
    defaultValue: 200,
    description: 'Максимум заказов за один запуск',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 0,
    description: 'Смещение для пакетного прогона',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;
}
