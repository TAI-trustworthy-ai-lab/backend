// src/routes/responseRoutes.ts
/**
 * @openapi
 * tags:
 *   name: Response
 *   description: APIs for submitting and viewing responses
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
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of responses
 */


import express from 'express';
import * as responseController from '../controllers/responseController';

const router = express.Router();

router.post('/', responseController.createResponse);
router.get('/:qid', responseController.getResponsesByQuestionnaireId);

export default router;
