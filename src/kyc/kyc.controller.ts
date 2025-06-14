import { Controller, Post, Get, Body, Param, Put, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { KycSubmitDto } from './dto/kyc-submit.dto';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { KycResponseDto } from './dto/kyc-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiOperation({ summary: 'Submit KYC documents' })
  @ApiResponse({ status: 201, description: 'KYC submitted successfully', type: KycResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'KYC submission with document upload',
    type: KycSubmitDto,
  })
  @UseGuards(JwtAuthGuard)
  @Post('submit')
  @UseInterceptors(FileInterceptor('documentImage', {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/^(image\/(jpg|jpeg|png|gif)|application\/pdf)$/)) {
        return callback(new Error('Only image files (jpg, jpeg, png, gif) or PDF files are allowed!'), false);
      }
      callback(null, true);
    },
  }))
  async submitKyc(
    @Request() req,
    @Body() kycData: KycSubmitDto,
    @UploadedFile() documentImage: Express.Multer.File,
  ) {
    // Validate that document image was provided
    if (!documentImage) {
      throw new BadRequestException('Document image is required');
    }
    console.log(kycData, "KYC Data");
    return this.kycService.submitKyc(req.user.userId, kycData, documentImage);
  }

  @ApiOperation({ summary: 'Get current user KYC status' })
  @ApiResponse({ status: 200, description: 'KYC details retrieved', type: KycResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'KYC not found' })
  @UseGuards(JwtAuthGuard)
  @Get('my-kyc')
  async getMyKyc(@Request() req) {
    return this.kycService.getKycByUserId(req.user.userId);
  }

  @ApiOperation({ summary: 'Get all KYC submissions (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all KYC submissions', type: [KycResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('all')
  async getAllKycs() {
    return this.kycService.getAllKycs();
  }

  @ApiOperation({ summary: 'Get pending KYC submissions (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of pending KYC submissions', type: [KycResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('pending')
  async getPendingKycs() {
    return this.kycService.getPendingKycs();
  }

  @ApiOperation({ summary: 'Update KYC status (Admin only)' })
  @ApiResponse({ status: 200, description: 'KYC status updated', type: KycResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'KYC not found' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id/status')
  async updateKycStatus(
    @Param('id') id: string,
    @Body() updateData: UpdateKycStatusDto,
  ) {
    return this.kycService.updateKycStatus(id, updateData);
  }
}