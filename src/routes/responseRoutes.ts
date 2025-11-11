// src/routes/responseRoutes.ts
/**
 * @openapi
 * tags:
 *   name: Response
 *   description: APIs for submitting and viewing responses
 *
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
 *
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

import express from 'express';
import * as responseController from '../controllers/responseController';

const router = express.Router();

router.post('/', responseController.createResponse);
router.get('/:vid', responseController.getResponsesByVersionId);

export default router;
