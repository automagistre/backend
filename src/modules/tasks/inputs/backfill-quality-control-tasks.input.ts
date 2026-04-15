import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@InputType()
export class BackfillQualityControlTasksInput {
  @Field(() => Int, {
    nullable: true,
    defaultValue: 30,
    description: 'Глубина поиска закрытых заказов в днях',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 500,
    description: 'Максимальное количество заказов за один запуск',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
