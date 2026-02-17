import { Injectable } from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
} from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as runtime from '@prisma/client/runtime/client';
import { setSessionParamsOnClient } from '../common/user-id.store';

type TransactionClient = Omit<PrismaClient, runtime.ITXClientDenyList>;

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });
    super({ adapter });
  }

  override $transaction<P extends Prisma.PrismaPromise<unknown>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<runtime.Types.Utils.UnwrapTuple<P>>;
  override $transaction<R>(
    fn: (
      prisma: TransactionClient,
    ) => Promise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<R>;
  override $transaction(
    arg:
      | ((prisma: TransactionClient) => Promise<unknown>)
      | Prisma.PrismaPromise<unknown>[],
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<unknown> {
    if (typeof arg === 'function') {
      const fn = arg;
      return super.$transaction(
        async (tx) => {
          await setSessionParamsOnClient(tx);
          return fn(tx);
        },
        options,
      );
    }
    return super.$transaction(arg, options);
  }
}
