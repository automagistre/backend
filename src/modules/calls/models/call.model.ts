import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  CallCallbackStatusEnum,
  CallDirectionEnum,
  CallPersonMatchStateEnum,
  CallRecordingStateEnum,
  CallStatusEnum,
} from '../enums/call.enums';

@ObjectType()
export class CallModel {
  @Field(() => ID)
  id: string;

  @Field()
  operator: string;

  @Field()
  providerCallSessionId: string;

  @Field(() => String, { nullable: true })
  providerCommunicationId: string | null;

  @Field(() => String, { nullable: true })
  providerExternalId: string | null;

  @Field(() => CallDirectionEnum)
  direction: CallDirectionEnum;

  @Field(() => CallStatusEnum)
  status: CallStatusEnum;

  @Field(() => Date)
  startedAt: Date;

  @Field(() => Date, { nullable: true })
  answeredAt: Date | null;

  @Field(() => Date, { nullable: true })
  endedAt: Date | null;

  @Field(() => Int, { nullable: true })
  durationSec: number | null;

  @Field(() => String, { nullable: true })
  callerPhone: string | null;

  @Field(() => String, { nullable: true })
  calleePhone: string | null;

  @Field(() => ID, { nullable: true })
  personId: string | null;

  @Field(() => String, { nullable: true })
  personFullName: string | null;

  @Field(() => CallPersonMatchStateEnum)
  personMatchState: CallPersonMatchStateEnum;

  @Field(() => Boolean)
  isMissed: boolean;

  @Field(() => CallCallbackStatusEnum)
  callbackStatus: CallCallbackStatusEnum;

  @Field(() => Date, { nullable: true })
  callbackMarkedAt: Date | null;

  @Field(() => ID, { nullable: true })
  callbackMarkedByUserId: string | null;

  @Field(() => String, { nullable: true })
  callbackMarkedByUserName: string | null;

  @Field(() => CallRecordingStateEnum)
  recordingState: CallRecordingStateEnum;

  @Field(() => String, { nullable: true })
  recordingPath: string | null;

  @Field(() => Date, { nullable: true })
  recordingAvailableUntil: Date | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
