export class CreatePartPriceDto {
  partId: string;

  since: Date;

  priceAmount: bigint | null;
}
