import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully. OTP sent to email.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Registration successful. Please verify your email with the OTP sent.' }
      }
    }
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: AuthResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @ApiOperation({ summary: 'Verify email with OTP' })
  @ApiResponse({ 
    status: 200, 
    description: 'Email verified successfully',
    type: AuthResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP or OTP expired' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Post('verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<AuthResponseDto> {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP resent successfully',
    schema: {
      properties: {
        message: { type: 'string', example: 'OTP resent successfully' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Email already verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Post('resend-otp')
  async resendOtp(@Body('email') email: string) {
    return this.authService.resendOtp(email);
  }

  @ApiOperation({ summary: 'Check if user is authenticated' })
  @ApiResponse({ status: 200, description: 'User is authenticated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('check-auth')
  async checkAuth() {
    return { authenticated: true };
  }
  
  @ApiOperation({ summary: 'Initiate Google Authentication' })
  @ApiResponse({ status: 302, description: 'Redirect to Google login page' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
  }

  @ApiOperation({ summary: 'Google Authentication Callback' })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req, @Res() res) {
    const { token, user } = req.user;
    // You can customize this URL to match your frontend application
    res.redirect(`http://localhost:3000/auth-success?token=${token}&userId=${user.id}`);
  }
}