export class CreatePartDiscountDto {
  partId: string;
  since: Date;
  discountAmount?: bigint | null;
  discountCurrencyCode?: string | null;
  tenantId?: string;
}

