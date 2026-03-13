import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { TemplateService } from './template.service';
import { ApplyTemplateInput } from './inputs/apply-template.input';
import { MaintenanceTemplateModel } from './models/maintenance-template.model';
import { TemplatesModel } from './models/templates.model';

@Resolver(() => TemplatesModel)
@RequireTenant()
export class TemplateResolver {
  constructor(private readonly templateService: TemplateService) {}

  @Query(() => TemplatesModel, {
    name: 'templates',
    description: 'Шаблоны для автомобиля, сгруппированные по типам (заполняются через field resolvers)',
  })
  async templates(
    @AuthContext() _ctx: AuthContextType,
    @Args('carId', { type: () => ID }) carId: string,
  ): Promise<{ carId: string }> {
    return { carId };
  }

  @ResolveField('maintenance', () => [MaintenanceTemplateModel])
  async maintenance(
    @AuthContext() ctx: AuthContextType,
    @Parent() parent: { carId: string },
  ) {
    return this.templateService.getMaintenanceTemplates(ctx, parent.carId);
  }

  @Mutation(() => Boolean, {
    name: 'applyTemplate',
    description: 'Применить шаблон к заказу: добавить переданные работы и запчасти.',
  })
  async applyTemplate(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: ApplyTemplateInput,
  ): Promise<boolean> {
    await this.templateService.applyTemplate(ctx, input);
    return true;
  }
}
