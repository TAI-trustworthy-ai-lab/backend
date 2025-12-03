import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Documentation for the Project API',
    },
    servers: [
      {
        url: process.env.API_URL?.startsWith('http')
          ? process.env.API_URL
          : `https://${process.env.API_URL}`,
        description: 'Development server',
      },
    ],
  },
  apis: [
  './src/routes/**/*.ts',   // 遞迴掃描所有子資料夾
  './src/controllers/**/*.ts',
  './src/**/*.ts',          // 保證全部 route 都能被掃到
  './dist/**/*.js'
],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export const setupSwagger = (app: Application) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
