import { registerEnumType } from '@nestjs/graphql';
import {
  CallCallbackStatus as PrismaCallCallbackStatus,
  CallDirection as PrismaCallDirection,
  CallEventType as PrismaCallEventType,
  CallPersonMatchState as PrismaCallPersonMatchState,
  CallRecordingSource as PrismaCallRecordingSource,
  CallRecordingState as PrismaCallRecordingState,
  CallStatus as PrismaCallStatus,
} from 'src/generated/prisma/enums';

export const CallDirectionEnum = PrismaCallDirection;
export type CallDirectionEnum =
  (typeof CallDirectionEnum)[keyof typeof CallDirectionEnum];

export const CallStatusEnum = PrismaCallStatus;
export type CallStatusEnum =
  (typeof CallStatusEnum)[keyof typeof CallStatusEnum];

export const CallPersonMatchStateEnum = PrismaCallPersonMatchState;
export type CallPersonMatchStateEnum =
  (typeof CallPersonMatchStateEnum)[keyof typeof CallPersonMatchStateEnum];

export const CallCallbackStatusEnum = PrismaCallCallbackStatus;
export type CallCallbackStatusEnum =
  (typeof CallCallbackStatusEnum)[keyof typeof CallCallbackStatusEnum];

export const CallRecordingStateEnum = PrismaCallRecordingState;
export type CallRecordingStateEnum =
  (typeof CallRecordingStateEnum)[keyof typeof CallRecordingStateEnum];

export const CallRecordingSourceEnum = PrismaCallRecordingSource;
export type CallRecordingSourceEnum =
  (typeof CallRecordingSourceEnum)[keyof typeof CallRecordingSourceEnum];

export const CallEventTypeEnum = PrismaCallEventType;
export type CallEventTypeEnum =
  (typeof CallEventTypeEnum)[keyof typeof CallEventTypeEnum];

registerEnumType(CallDirectionEnum, {
  name: 'CallDirection',
});

registerEnumType(CallStatusEnum, {
  name: 'CallStatus',
});

registerEnumType(CallPersonMatchStateEnum, {
  name: 'CallPersonMatchState',
});

registerEnumType(CallCallbackStatusEnum, {
  name: 'CallCallbackStatus',
});

registerEnumType(CallRecordingStateEnum, {
  name: 'CallRecordingState',
});

registerEnumType(CallRecordingSourceEnum, {
  name: 'CallRecordingSource',
});

registerEnumType(CallEventTypeEnum, {
  name: 'CallEventType',
});
