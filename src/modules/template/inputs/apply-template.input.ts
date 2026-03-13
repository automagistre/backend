import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType({ description: 'Работа в применении шаблона' })
export class ApplyTemplateWorkInput {
  @Field(() => String)
  name: string;

  @Field(() => MoneyInput, { nullable: true })
  price?: MoneyInput | null;
}

@InputType({ description: 'Запчасть в применении шаблона (в рамках одной работы)' })
export class ApplyTemplatePartInput {
  @Field(() => ID)
  partId: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => MoneyInput, { nullable: true })
  price?: MoneyInput | null;
}

@InputType({ description: 'Элемент шаблона: работа и её запчасти' })
export class ApplyTemplateItemInput {
  @Field(() => ApplyTemplateWorkInput)
  work: ApplyTemplateWorkInput;

  @Field(() => [ApplyTemplatePartInput], { defaultValue: [] })
  parts: ApplyTemplatePartInput[];
}

@InputType({ description: 'Применить шаблон к заказу: дерево работ и запчастей' })
export class ApplyTemplateInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => [ApplyTemplateItemInput], {
    description: 'Элементы шаблона: каждая работа и массив её запчастей',
  })
  items: ApplyTemplateItemInput[];
}
