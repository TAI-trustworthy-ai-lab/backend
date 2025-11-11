// src/routes/responseRoutes.ts
import express from 'express';
import * as responseController from '../controllers/responseController';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Response
 *   description: APIs for submitting and viewing responses
 */

/**
 * @openapi
 * /api/response:
 *   post:
 *     summary: Submit a questionnaire response for a specific version
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
 *                 example: 1
 *               projectId:
 *                 type: integer
 *                 example: 2
 *               versionId:
 *                 type: integer
 *                 example: 4
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: integer
 *                       example: 10
 *                     optionId:
 *                       type: integer
 *                       example: 3
 *                     value:
 *                       type: integer
 *                       example: 5
 *                     textValue:
 *                       type: string
 *                       example: "AI 系統的透明度很高"
 *     responses:
 *       201:
 *         description: Response submitted successfully
 */
router.post('/', responseController.createResponse);

/**
 * @openapi
 * /api/response/{vid}:
 *   get:
 *     summary: Get all responses for a specific questionnaire version
 *     tags: [Response]
 *     parameters:
 *       - in: path
 *         name: vid
 *         required: true
 *         schema:
 *           type: integer
 *           example: 4
 *     responses:
 *       200:
 *         description: List of responses for this version
 */
router.get('/:vid', responseController.getResponsesByVersionId);

/**
 * @openapi
 * /api/response/user/{userId}:
 *   get:
 *     summary: Get all responses by a specific user
 *     tags: [Response]
 */
router.get('/user/:userId', responseController.getResponsesByUserId);

/**
 * @openapi
 * /api/response/project/{projectId}:
 *   get:
 *     summary: Get all responses under a specific project
 *     tags: [Response]
 */
router.get('/project/:projectId', responseController.getResponsesByProjectId);

/**
 * @openapi
 * /api/response/{id}:
 *   patch:
 *     summary: Update an existing response (answers)
 *     tags: [Response]
 */
router.patch('/:id', responseController.updateResponse);

/**
 * @openapi
 * /api/response/{id}:
 *   delete:
 *     summary: Delete a specific response
 *     tags: [Response]
 */
router.delete('/:id', responseController.deleteResponse);

export default router;
