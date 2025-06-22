import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { CryptoNetwork } from '../../db/entities/deposit.entity';

export class CryptoDepositDto {
  @ApiProperty({ description: 'Asset ID to deposit', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ 
    description: 'Blockchain network', 
    enum: CryptoNetwork,
    example: CryptoNetwork.BINANCE_SMART_CHAIN 
  })
  @IsEnum(CryptoNetwork)
  network: CryptoNetwork;
}