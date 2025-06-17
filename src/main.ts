import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { json } from 'body-parser';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  // Create NestJS app with Express instance
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable the built-in body parser
  });

  // Enable CORS
  app.enableCors();
  
  // Configure Express to use raw body for Stripe webhooks
  app.use(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    (req: Request, res: Response, next: NextFunction) => {
      // Store raw body for signature verification
      if (req.body) {
        req.rawBody = req.body;
      }
      next();
    }
  );
  
  // For all other routes, use JSON parsing
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/webhooks/stripe') {
      return next();
    }
    return json()(req, res, next);
  });
  
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