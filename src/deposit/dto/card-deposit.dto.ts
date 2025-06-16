import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min, IsOptional } from 'class-validator';

export class CardDepositDto {
  @ApiProperty({ description: 'Amount to deposit', example: 100 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Asset ID to deposit', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ description: 'Card token from Stripe Elements', example: 'tok_visa' })
  @IsString()
  @IsNotEmpty()
  cardToken: string;
}