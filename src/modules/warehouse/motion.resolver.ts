import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { MotionModel } from './models/motion.model';
import {
  MotionSourceUnion,
  MotionSourceType,
} from './unions/motion-source.union';
import { MotionSourceLoader } from './loaders/motion-source.loader';
import { MotionSourceType as MotionSourceTypeEnum } from './enums/motion-source-type.enum';

@Resolver(() => MotionModel)
export class MotionResolver {
  constructor(private readonly sourceLoader: MotionSourceLoader) {}

  @ResolveField('source', () => MotionSourceUnion, { nullable: true })
  async source(
    @Parent()
    motion: {
      sourceType: MotionSourceTypeEnum;
      sourceId: string;
      description?: string | null;
    },
  ): Promise<MotionSourceType | null> {
    if (!motion.sourceId) return null;

    return this.sourceLoader.load({
      sourceType: motion.sourceType,
      sourceId: motion.sourceId,
      description: motion.description,
    });
  }
}
