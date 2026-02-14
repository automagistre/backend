import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Expense } from 'src/generated/prisma/client';
import { WalletModel } from 'src/modules/wallet/models/wallet.model';

@ObjectType({ description: 'Статья расходов' })
export class ExpenseModel implements Expense {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'Название' })
  name: string;

  @Field(() => String, { nullable: true, description: 'ID счёта по умолчанию' })
  walletId: string | null;

  @Field(() => String)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => WalletModel, { nullable: true, description: 'Счёт по умолчанию' })
  wallet?: WalletModel | null;
}
