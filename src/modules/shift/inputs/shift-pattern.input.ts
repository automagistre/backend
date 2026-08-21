import { Field, InputType } from '@nestjs/graphql';

/** Пара «маска + якорь» неразделима, поэтому и приходит вместе: null снимает график целиком. */
@InputType()
export class ShiftPatternInput {
  @Field(() => String, { description: 'Маска цикла из 1 и 0: 5/2 это 1111100' })
  mask: string;

  @Field(() => String, {
    description: 'Дата первого символа маски, ГГГГ-ММ-ДД',
  })
  startsOn: string;
}
