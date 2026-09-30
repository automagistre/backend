import { BadRequestException } from '@nestjs/common';
import { assertValidScheme } from '../calculator/motivation-calculator';
import type {
  MotivationItemType,
  MotivationScheme,
  MotivationStageRates,
} from '../calculator/motivation-calculator.types';
import {
  MOTIVATION_STAGE_RULES,
  motivationProfileKeys,
} from '../calculator/motivation-stages';
import {
  MotivationItemTypeEnum,
  MotivationStageEnum,
} from './motivation.enums';
import type { MotivationSchemeModel } from './motivation-scheme.model';

const ITEM_TYPES = Object.values(MotivationItemTypeEnum);

/** Наружу — все этапы и профили из правил, даже нулевые и пустые: форма показывает полный состав. */
export function toMotivationSchemeModel(
  scheme: MotivationScheme,
): MotivationSchemeModel {
  return {
    profiles: motivationProfileKeys().map((key) => ({
      key,
      weights: Object.entries(scheme.profiles[key] ?? {}).map(
        ([positionId, weight]) => ({ positionId, weight }),
      ),
    })),
    types: ITEM_TYPES.map((type) => ({
      type,
      stages: MOTIVATION_STAGE_RULES[type].map((rule) => ({
        stage: rule.stage as MotivationStageEnum,
        rateBp: scheme.rates[type]?.[rule.stage] ?? 0,
      })),
    })),
  };
}

/** Схема из формы: неполную или противоречивую не сохраняем. */
export function fromMotivationSchemeInput(
  input: MotivationSchemeModel,
): MotivationScheme {
  const profiles: MotivationScheme['profiles'] = {};
  for (const profile of input.profiles) {
    if (profiles[profile.key]) {
      throw new BadRequestException(`Профиль «${profile.key}» указан дважды`);
    }
    profiles[profile.key] = Object.fromEntries(
      profile.weights
        .filter((weight) => weight.weight > 0)
        .map((weight) => [weight.positionId, weight.weight]),
    );
  }

  const rates = {} as Record<MotivationItemType, MotivationStageRates>;
  for (const typeScheme of input.types) {
    rates[typeScheme.type] = Object.fromEntries(
      typeScheme.stages
        .filter((stage) => stage.rateBp > 0)
        .map((stage) => [stage.stage, stage.rateBp]),
    );
  }
  const missing = ITEM_TYPES.filter((type) => !rates[type]);
  if (missing.length) {
    throw new BadRequestException(`В схеме нет типов: ${missing.join(', ')}`);
  }

  const scheme: MotivationScheme = { profiles, rates };
  try {
    assertValidScheme(scheme);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Схема некорректна',
    );
  }
  return scheme;
}
