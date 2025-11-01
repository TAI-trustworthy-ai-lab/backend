// src/routes/questionnaireRoutes.ts
/**
 * @openapi
 * tags:
 *   name: Questionnaire
 *   description: APIs for managing questionnaires
 *
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
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Questionnaire details
 */



import express from 'express';
import * as questionnaireController from '../controllers/questionnaireController';

const router = express.Router();

router.post('/', questionnaireController.createQuestionnaire);
router.get('/:id', questionnaireController.getQuestionnaireById);

export default router;
