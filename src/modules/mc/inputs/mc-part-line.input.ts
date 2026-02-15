import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsUUID, Min } from 'class-validator';

@InputType({ description: 'Запчасть в строке карты ТО' })
export class McPartLineInput {
  @IsUUID()
  @Field(() => String, { description: 'ID запчасти' })
  partId: string;

  @IsInt()
  @Min(1)
  @Field(() => Int, { description: 'Количество' })
  quantity: number;

  @IsBoolean()
  @Field(() => Boolean, { description: 'Рекомендуемая' })
  recommended: boolean;
}
