import { ApiProperty } from '@nestjs/swagger';

export class KycResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: '1990-01-01' })
  dob: string;

  @ApiProperty({ example: '123 Main St, City, Country' })
  address: string;

  @ApiProperty({ example: 'United States' })
  country: string;

  @ApiProperty({ example: 'Passport' })
  documentType: string;

  @ApiProperty({ example: 'AB123456' })
  documentNumber: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket-name/kyc/document.jpg' })
  documentImageUrl: string | null;

  @ApiProperty({ example: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  submittedAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  updatedAt: Date;
}