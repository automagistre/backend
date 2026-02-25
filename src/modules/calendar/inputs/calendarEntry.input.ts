import {
  Field,
  ID,
  InputType,
  OmitType,
  PartialType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const ISO_DURATION_PATTERN =
  /^(?:PT(?:(?:\d+H)?(?:\d+M)?(?:\d+S)?)|[+-]?P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(?:\d+H)?(?:\d+M)?(?:\d+S)?))$/i;

export enum DeletionReason {
  NO_REASON = 'NO_REASON',
  PLAN_ANOTHER_TIME = 'PLAN_ANOTHER_TIME',
  NOT_HAVE_TIME_TO_ARRIVE = 'NOT_HAVE_TIME_TO_ARRIVE',
  SOLVE_PROBLEM_WITHOUT_SERVICE = 'SOLVE_PROBLEM_WITHOUT_SERVICE',
  WE_ARE_CONDOMS = 'WE_ARE_CONDOMS',
}

export const DeletionReasonLabels: Record<DeletionReason, string> = {
  [DeletionReason.NO_REASON]: 'Заказчик отменил запись без причины',
  [DeletionReason.PLAN_ANOTHER_TIME]:
    'Заказчик планирует записаться на другое время',
  [DeletionReason.NOT_HAVE_TIME_TO_ARRIVE]: 'Заказчик не успевает приехать',
  [DeletionReason.SOLVE_PROBLEM_WITHOUT_SERVICE]:
    'Заказчик решил проблему до приезда в сервис',
  [DeletionReason.WE_ARE_CONDOMS]:
    'Заказчик где то узнал что мы гондоны и не приехал',
};

registerEnumType(DeletionReason, {
  name: 'DeletionReason',
  description: 'Причины удаления записи в календаре',
});

@InputType()
export class CreateCalendarEntryInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  carId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @Field(() => Date)
  @IsDate()
  date: Date;

  @Field(() => String)
  @IsString()
  @Matches(ISO_DURATION_PATTERN, { message: 'duration must be valid ISO 8601 duration' })
  duration: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@InputType()
export class UpdateCalendarEntryInput extends PartialType(
  OmitType(CreateCalendarEntryInput, ['carId', 'customerId']),
) {
  @Field(() => ID)
  @IsUUID()
  id: string;
}

@InputType()
export class DeleteCalendarEntryInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => DeletionReason)
  @IsEnum(DeletionReason)
  reason: DeletionReason;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
