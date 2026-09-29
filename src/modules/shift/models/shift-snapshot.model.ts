import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Сотрудник в должности в снимке смены' })
export class ShiftSnapshotMemberModel {
  @Field(() => ID)
  employeeId: string;

  @Field(() => ID)
  personId: string;

  @Field(() => String, { nullable: true })
  employeeName: string | null;

  @Field(() => ID)
  positionId: string;

  @Field(() => String)
  positionName: string;
}

@ObjectType({
  description: 'Состав смены рабочего дня на момент продающего действия',
})
export class ShiftSnapshotModel {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'Рабочий день, ГГГГ-ММ-ДД' })
  workDate: string;

  @Field(() => Date)
  takenAt: Date;

  @Field(() => [ShiftSnapshotMemberModel], {
    description: 'Пустой список — в смене никого не было',
  })
  members: ShiftSnapshotMemberModel[];
}
