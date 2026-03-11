import { Field, ObjectType } from '@nestjs/graphql';
import { PartModel } from './part.model';

@ObjectType()
export class PartSmartAutocompleteItemModel {
  @Field(() => PartModel)
  part: PartModel;

  @Field(() => Boolean, { defaultValue: false })
  isAnalog: boolean;

  @Field(() => String, { nullable: true })
  analogGroupKey?: string | null;

  @Field(() => String, { nullable: true })
  analogGroupLabel?: string | null;
}
