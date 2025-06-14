import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kyc } from '../db/entities/kyc.entity';
import { User, KycStatus as UserKycStatus } from '../db/entities/user.entity';
import { KycSubmitDto } from './dto/kyc-submit.dto';
import { UpdateKycStatusDto, KycStatus } from './dto/update-kyc-status.dto';
import { FileUploadService } from './file-upload.service';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(Kyc)
    private kycRepository: Repository<Kyc>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private fileUploadService: FileUploadService,
  ) {}

  async submitKyc(userId: string, kycData: KycSubmitDto, documentImage?: Express.Multer.File): Promise<Kyc> {
    console.log(kycData, "kycData");
    let documentImageUrl: string | undefined;
    // Check if user exists
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      select: ['id', 'email', 'emailVerified', 'kycStatus', 'roles'] 
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if KYC already exists for this user
    const existingKyc = await this.kycRepository.findOne({
      where: { user: { id: userId } },
    });

    if (existingKyc) {
      throw new BadRequestException('KYC already submitted for this user');
    }

    // Upload document if provided
    if (documentImage) {
      documentImageUrl = await this.fileUploadService.uploadFile(documentImage);
    }
    
    // Create new KYC entry
    const kyc = this.kycRepository.create({
      user,
      fullName: kycData.fullName,
      dob: kycData.dob,
      address: kycData.address,
      country: kycData.country,
      documentType: kycData.documentType,
      documentNumber: kycData.documentNumber,
      documentImageUrl: documentImageUrl,
      status: 'pending',
    });

    console.log(kyc, "kyc");
    // Update user's KYC status
    user.kycStatus = UserKycStatus.PENDING;
    await this.userRepository.save(user);

    return this.kycRepository.save(kyc);
  }

  async getKycByUserId(userId: string): Promise<Kyc> {
    const kyc = await this.kycRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
      select: {
        id: true,
        fullName: true,
        dob: true,
        address: true,
        country: true,
        documentType: true,
        documentNumber: true,
        documentImageUrl: true,
        status: true,
        createdAt: true,
        user: {
          id: true,
          email: true,
          kycStatus: true
        }
      }
    });

    if (!kyc) {
      throw new NotFoundException('KYC not found for this user');
    }

    return kyc;
  }

  async getAllKycs(): Promise<Kyc[]> {
    return this.kycRepository.find({
      relations: ['user'],
      select: {
        id: true,
        fullName: true,
        country: true,
        documentType: true,
        documentImageUrl: true,
        status: true,
        createdAt: true,
        user: {
          id: true,
          email: true,
          kycStatus: true
        }
      }
    });
  }

  async getPendingKycs(): Promise<Kyc[]> {
    return this.kycRepository.find({
      where: { status: 'pending' },
      relations: ['user'],
      select: {
        id: true,
        fullName: true,
        country: true,
        documentType: true,
        documentImageUrl: true,
        status: true,
        createdAt: true,
        user: {
          id: true,
          email: true,
          kycStatus: true
        }
      }
      
    });
  }

  async updateKycStatus(kycId: string, updateData: UpdateKycStatusDto): Promise<Kyc> {
    const kyc = await this.kycRepository.findOne({
      where: { id: kycId },
      relations: ['user'],
      select: {
        id: true,
        fullName: true,
        dob: true,
        address: true,
        country: true,
        documentType: true,
        documentNumber: true,
        documentImageUrl: true,
        status: true,
        createdAt: true,
        user: {
          id: true,
          email: true,
          kycStatus: true
        }
      }
    });

    if (!kyc) {
      throw new NotFoundException('KYC not found');
    }

    kyc.status = updateData.status;
    
    // Update user's KYC status as well
    if (kyc.user) {
      kyc.user.kycStatus = updateData.status === KycStatus.APPROVED ? UserKycStatus.VERIFIED : 
                          updateData.status === KycStatus.REJECTED ? UserKycStatus.REJECTED : UserKycStatus.PENDING;
      await this.userRepository.save(kyc.user);
    }

    return this.kycRepository.save(kyc);
  }
}