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
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export const setupSwagger = (app: Application) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

/**
 * @openapi
 * /api/questionnaire:
 *   post:
 *     summary: Create a new questionnaire
 *     tags: [Questionnaire]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     category:
 *                       type: string
 *                     order:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Questionnaire created
 *
 * /api/questionnaire/{id}:
 *   get:
 *     summary: Get questionnaire by ID
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Questionnaire details
 *
 * /api/response:
 *   post:
 *     summary: Submit a questionnaire response
 *     tags: [Response]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               questionnaireId:
 *                 type: integer
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: integer
 *                     value:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Response submitted
 *
 * /api/response/{qid}:
 *   get:
 *     summary: Get all responses for a questionnaire
 *     tags: [Response]
 *     parameters:
 *       - in: path
 *         name: qid
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: List of responses
 */
