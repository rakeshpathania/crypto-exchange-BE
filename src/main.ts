import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';

async function bootstrap() {
  // Create Express instance
  const expressApp = express();
  
  // Configure Express to use raw body for Stripe webhooks
  expressApp.use(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
  );
  
  // Create NestJS app with Express instance
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // For all other routes, use JSON parsing
  app.use(express.json());
  
  // Set up validation
  app.useGlobalPipes(new ValidationPipe());
  
  // Set up Swagger
  const config = new DocumentBuilder()
    .setTitle('Crypto Exchange API')
    .setDescription('API documentation for the Crypto Exchange')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  // Start the server
  await app.listen(3000);
}
bootstrap();