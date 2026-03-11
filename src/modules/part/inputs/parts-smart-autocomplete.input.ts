import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class PartsSmartAutocompleteInput {
  @Field(() => String)
  search: string;

  @Field(() => Int, { nullable: true, defaultValue: 50 })
  take?: number;

  @Field(() => ID, { nullable: true })
  vehicleId?: string | null;
}
