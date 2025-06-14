import { Injectable, ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../db/entities/user.entity';
import { Verification } from '../db/entities/verification.entity';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Verification)
    private verificationsRepository: Repository<Verification>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, password } = registerDto;

    // Check if user exists
    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user
    const user = this.usersRepository.create({
      email,
      passwordHash,
      emailVerified: false,
    });

    await this.usersRepository.save(user);

    // Generate and send OTP
    await this.sendVerificationOtp(user);

    return { message: 'Registration successful. Please verify your email with the OTP sent.' };
  }

  async login(loginDto: LoginDto): Promise<{ token: string, user: Partial<User> }> {
    const { email, password } = loginDto;
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Please verify your email first.');
    }

    const token = this.generateToken(user);
    
    // Return user data without sensitive information
    const { passwordHash, ...userData } = user;
    return { token, user: userData };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ token: string, user: Partial<User> }> {
    const { email, otp } = verifyOtpDto;
    
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification = await this.verificationsRepository.findOne({
      where: { 
        userId: user.id,
        otp,
        verified: false
      },
      order: { createdAt: 'DESC' }
    });

    if (!verification) {
      throw new BadRequestException('Invalid OTP');
    }

    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('OTP expired');
    }

    // Mark OTP as verified
    verification.verified = true;
    await this.verificationsRepository.save(verification);

    // Update user's email verification status
    user.emailVerified = true;
    await this.usersRepository.save(user);

    // Generate JWT token
    const token = this.generateToken(user);
    
    // Return user data without sensitive information
    const { passwordHash, ...userData } = user;
    return { token, user: userData };
  }


  async sendVerificationOtp(user: User): Promise<void> {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Save OTP to database
    const verification = this.verificationsRepository.create({
      otp,
      expiresAt,
      userId: user.id,
      verified: false
    });

    await this.verificationsRepository.save(verification);

    try {
      // Send OTP via email
      await this.emailService.sendOtp(user.email, otp);
    } catch (error) {
      // Log error and fallback to console for development
      console.error('Failed to send email:', error.message);
      console.log(`OTP for ${user.email}: ${otp}`);
    }
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.sendVerificationOtp(user);
    return { message: 'OTP resent successfully' };
  }

  async validateUserById(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private generateToken(user: User): string {
    const payload = { email: user.email, sub: user.id };
    return this.jwtService.sign(payload);
  }


  async validateGoogleUser(details: any): Promise<{ token: string, user: Partial<User> }> {
    const { email } = details;

    let user = await this.usersRepository.findOne({ where: { email } });

    if (user) {
      // Update existing user if needed
      user.emailVerified = true;
      await this.usersRepository.save(user);
    } else {
      // Create a new user with a random password hash
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(Math.random().toString(36), salt);
      
      user = this.usersRepository.create({
        email,
        passwordHash,
        emailVerified: true,
      });
      await this.usersRepository.save(user);
    }

    // Generate token and return user data
    const token = this.generateToken(user);
    const { passwordHash, ...userData } = user;
    return { token, user: userData };
  }

}
