import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { ShiftDayModel } from './models/shift-day.model';
import {
  SetShiftDaysInput,
  ShiftDaysRangeInput,
} from './inputs/shift-day.input';
import { ShiftService } from './shift.service';

@Resolver(() => ShiftDayModel)
@RequireTenant()
export class ShiftResolver {
  constructor(private readonly shiftService: ShiftService) {}

  @Query(() => [ShiftDayModel], {
    name: 'shiftDays',
    description: 'График сотрудников за период: цикл и отметки уже сведены',
  })
  async shiftDays(
    @AuthContext() ctx: AuthContextType,
    @Args('from', { description: 'ГГГГ-ММ-ДД' }) from: string,
    @Args('to', { description: 'ГГГГ-ММ-ДД' }) to: string,
    @Args('employeeId', { type: () => String, nullable: true })
    employeeId?: string,
  ) {
    return this.shiftService.findDays(ctx, { from, to, employeeId });
  }

  @Mutation(() => [ShiftDayModel], {
    name: 'setShiftDays',
    description: 'Проставить отметку на диапазон дней',
  })
  async setShiftDays(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: SetShiftDaysInput,
  ) {
    return this.shiftService.setDays(ctx, input);
  }

  @Mutation(() => [ShiftDayModel], {
    name: 'clearShiftDays',
    description: 'Снять отметки: дни возвращаются в цикл',
  })
  async clearShiftDays(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: ShiftDaysRangeInput,
  ) {
    return this.shiftService.clearDays(ctx, input);
  }
}
