import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMcEquipmentInput } from './create-mc-equipment.input';
import { McLineInput } from './mc-line-input';

@InputType()
export class UpdateMcEquipmentInput extends PartialType(CreateMcEquipmentInput) {
  @IsUUID()
  @Field(() => ID)
  id: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McLineInput)
  @Field(() => [McLineInput], {
    nullable: true,
    description: 'Дерево работ и запчастей. При указании заменяет текущее.',
  })
  lines?: McLineInput[];
}
