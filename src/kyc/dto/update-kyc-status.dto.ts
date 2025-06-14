import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class UpdateKycStatusDto {
  @ApiProperty({ 
    description: 'KYC verification status', 
    enum: KycStatus,
    example: KycStatus.APPROVED
  })
  @IsNotEmpty()
  @IsEnum(KycStatus)
  status: KycStatus;
}