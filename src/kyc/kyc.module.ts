import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { FileUploadService } from './file-upload.service';
import { Kyc } from '../db/entities/kyc.entity';
import { User } from '../db/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kyc, User]),
  ],
  controllers: [KycController],
  providers: [KycService, FileUploadService],
  exports: [KycService],
})
export class KycModule {}