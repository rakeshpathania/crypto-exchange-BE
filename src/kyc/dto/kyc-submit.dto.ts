import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class KycSubmitDto {
  @ApiProperty({ description: 'Full legal name of the user' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'Date of birth in ISO format (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  dob: string;

  @ApiProperty({ description: 'Full residential address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Country of residence' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'Type of identification document (passport, national ID, etc.)' })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiProperty({ description: 'Document identification number' })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiProperty({ 
    description: 'Document image file (passport, ID card, etc.)', 
    type: 'string', 
    format: 'binary',
    required: false
  })
  @IsOptional()
  documentImage?: any;
}