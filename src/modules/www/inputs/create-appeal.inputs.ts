import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { MoneyInputScalar } from '../scalars/money-input.scalar';
import type { Money } from '../../../common/money';
import { WwwTireFittingCategory } from '../enums/tire-fitting-category.enum';

// ────────────────────────────────────────────────────────────────────────────
// Calculator (форма "рассчитать стоимость ТО" на www)
// ────────────────────────────────────────────────────────────────────────────

@InputType('SiteCalculatorWorkPartInput')
export class WwwCalculatorWorkPartInput {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => MoneyInputScalar)
  price: Money;

  @Field(() => Int)
  count: number;

  @Field(() => Boolean)
  isSelected: boolean;
}

@InputType('SiteCalculatorWorkInput')
export class WwwCalculatorWorkInput {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => MoneyInputScalar)
  price: Money;

  @Field(() => String, {
    description: 'Тип работы: "work" или "recommendation"',
  })
  type: string;

  @Field(() => Boolean)
  isSelected: boolean;

  @Field(() => [WwwCalculatorWorkPartInput], { nullable: true })
  parts?: WwwCalculatorWorkPartInput[];
}

@InputType('SiteCreateAppealCalculatorInput')
export class WwwCreateAppealCalculatorInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  phone: string;

  @Field(() => String, { nullable: true })
  note?: string;

  @Field(() => Date, { nullable: true })
  date?: Date;

  @Field(() => ID)
  equipmentId: string;

  @Field(() => Int)
  mileage: number;

  @Field(() => MoneyInputScalar)
  total: Money;

  @Field(() => [WwwCalculatorWorkInput])
  works: WwwCalculatorWorkInput[];
}

// ────────────────────────────────────────────────────────────────────────────
// Schedule (форма "записаться")
// ────────────────────────────────────────────────────────────────────────────

@InputType('SiteCreateAppealScheduleInput')
export class WwwCreateAppealScheduleInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  phone: string;

  @Field(() => Date)
  date: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// Cooperation (форма "сотрудничество")
// ────────────────────────────────────────────────────────────────────────────

@InputType('SiteCreateAppealCooperationInput')
export class WwwCreateAppealCooperationInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  phone: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Question (форма "задать вопрос")
// ────────────────────────────────────────────────────────────────────────────

@InputType('SiteCreateAppealQuestionInput')
export class WwwCreateAppealQuestionInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  question: string;
}

// ────────────────────────────────────────────────────────────────────────────
// TireFitting (калькулятор шиномонтажа)
// ────────────────────────────────────────────────────────────────────────────

@InputType('SiteTireFittingWorkInput')
export class WwwTireFittingWorkInput {
  @Field(() => String)
  name: string;

  @Field(() => MoneyInputScalar)
  price: Money;
}

@InputType('SiteCreateAppealTireFittingInput')
export class WwwCreateAppealTireFittingInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  phone: string;

  @Field(() => ID, { nullable: true })
  vehicleId?: string;

  @Field(() => WwwTireFittingCategory)
  category: WwwTireFittingCategory;

  @Field(() => Int, { nullable: true })
  diameter?: number;

  @Field(() => MoneyInputScalar)
  total: Money;

  @Field(() => [WwwTireFittingWorkInput])
  works: WwwTireFittingWorkInput[];
}

// ────────────────────────────────────────────────────────────────────────────
// Call (просто оставить телефон)
// ────────────────────────────────────────────────────────────────────────────

@InputType('SiteCreateAppealCallInput')
export class WwwCreateAppealCallInput {
  @Field(() => String)
  phone: string;
}
