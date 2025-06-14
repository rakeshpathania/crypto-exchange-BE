import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';

@Injectable()
export class FileUploadService {
  private s3Client: S3Client | null = null;
  private readonly useAwsS3: boolean;
  private readonly localUploadPath: string;
  private readonly awsBucket: string | null;

  constructor(private configService: ConfigService) {
    this.useAwsS3 = this.configService.get<string>('STORAGE_TYPE') === 'aws';
    this.localUploadPath = this.configService.get<string>('LOCAL_UPLOAD_PATH') || 'uploads/kyc';

    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    this.awsBucket = bucket ?? null;

    if (this.useAwsS3) {
      const region = this.configService.get<string>('AWS_REGION');
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

      if (!bucket || !region || !accessKeyId || !secretAccessKey) {
        throw new Error('Missing AWS S3 configuration');
      }

      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
    } else {
      if (!fs.existsSync(this.localUploadPath)) {
        fs.mkdirSync(this.localUploadPath, { recursive: true });
      }
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (this.useAwsS3) {
      return this.uploadToS3(file);
    } else {
      return this.uploadToLocal(file);
    }
  }

  private async uploadToS3(file: Express.Multer.File): Promise<string> {
    if (!this.s3Client || !this.awsBucket) {
      throw new Error('S3 client or bucket not initialized');
    }

    const region = this.configService.get<string>('AWS_REGION')!;
    const fileKey = `kyc/${uuidv4()}-${file.originalname}`;

    const params = {
      Bucket: this.awsBucket,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: ObjectCannedACL.private,
    };

    const command = new PutObjectCommand(params);
    await this.s3Client.send(command);

    return `https://${this.awsBucket}.s3.${region}.amazonaws.com/${fileKey}`;
  }

  private async uploadToLocal(file: Express.Multer.File): Promise<string> {
    const fileName = `${uuidv4()}-${file.originalname}`;
    const filePath = path.join(this.localUploadPath, fileName);

    await fs.promises.writeFile(filePath, file.buffer);

    return `/${this.localUploadPath}/${fileName}`;
  }
}
