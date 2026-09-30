import { BadRequestException } from '@nestjs/common';
import { assertValidScheme } from '../calculator/motivation-calculator';
import type {
  MotivationItemType,
  MotivationScheme,
  MotivationSourceRef,
  MotivationTypeScheme,
} from '../calculator/motivation-calculator.types';
import {
  MotivationItemTypeEnum,
  MotivationPolicyEnum,
  MotivationStageEnum,
} from './motivation.enums';
import {
  MOTIVATION_SOURCES,
  type MotivationSchemeModel,
} from './motivation-scheme.model';

const ITEM_TYPES = Object.values(MotivationItemTypeEnum);

export function toMotivationSchemeModel(
  scheme: MotivationScheme,
): MotivationSchemeModel {
  return {
    profiles: Object.entries(scheme.profiles).map(([key, weights]) => ({
      key,
      weights: Object.entries(weights).map(([positionId, weight]) => ({
        positionId,
        weight,
      })),
    })),
    types: ITEM_TYPES.map((type) => ({
      type,
      rateBp: scheme.types[type].rateBp,
      stages: scheme.types[type].stages.map((stage) => ({
        stage: stage.stage as MotivationStageEnum,
        shareBp: stage.shareBp,
        policy: stage.policy as MotivationPolicyEnum,
        redistributeTo: (stage.redistributeTo ?? null) as
          MotivationStageEnum[] | null,
        chain: stage.chain.map((step) => ({ ...step })),
      })),
    })),
  };
}

/** Схема из формы бэктеста: неполную или противоречивую не считаем. */
export function fromMotivationSchemeInput(
  input: MotivationSchemeModel,
): MotivationScheme {
  const profiles: MotivationScheme['profiles'] = {};
  for (const profile of input.profiles) {
    if (profiles[profile.key]) {
      throw new BadRequestException(`Профиль «${profile.key}» указан дважды`);
    }
    profiles[profile.key] = Object.fromEntries(
      profile.weights.map((weight) => [weight.positionId, weight.weight]),
    );
  }

  const types = {} as Record<MotivationItemType, MotivationTypeScheme>;
  for (const typeScheme of input.types) {
    types[typeScheme.type] = {
      rateBp: typeScheme.rateBp,
      stages: typeScheme.stages.map((stage) => ({
        stage: stage.stage,
        shareBp: stage.shareBp,
        policy: stage.policy,
        ...(stage.redistributeTo?.length
          ? { redistributeTo: stage.redistributeTo }
          : {}),
        chain: stage.chain.map((step) => ({
          source: toSourceRef(step.source),
          profile: step.profile,
        })),
      })),
    };
  }
  const missing = ITEM_TYPES.filter((type) => !types[type]);
  if (missing.length) {
    throw new BadRequestException(`В схеме нет типов: ${missing.join(', ')}`);
  }

  const scheme: MotivationScheme = { profiles, types };
  try {
    assertValidScheme(scheme);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Схема некорректна',
    );
  }
  return scheme;
}

function toSourceRef(source: string): MotivationSourceRef {
  if (!(MOTIVATION_SOURCES as readonly string[]).includes(source)) {
    throw new BadRequestException(
      `Неизвестный источник участников «${source}»`,
    );
  }
  return source as MotivationSourceRef;
}
