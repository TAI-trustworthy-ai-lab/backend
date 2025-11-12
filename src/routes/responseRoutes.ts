// src/routes/responseRoutes.ts
import express from 'express';
import * as responseController from '../controllers/responseController';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Response
 *   description: APIs for submitting and viewing questionnaire responses
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
 * /api/response/id/{id}:
 *   get:
 *     summary: Get a single response by ID (includes user, project, version, questions, and answers)
 *     tags: [Response]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 12
 *     responses:
 *       200:
 *         description: A single detailed response
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 12
 *                 user:
 *                   id: 1
 *                   name: "Alice"
 *                   email: "alice@example.com"
 *                 project:
 *                   id: 2
 *                   name: "AI 系統建模前評估"
 *                 version:
 *                   id: 4
 *                   title: "建模前問卷"
 *                 answers:
 *                   - id: 101
 *                     question:
 *                       id: 10
 *                       text: "請為 AI 系統的準確性打分"
 *                       type: "SCALE"
 *                       category: "Accuracy"
 *                     value: 4
 *                     option: null
 *                     textValue: null
 *                   - id: 102
 *                     question:
 *                       id: 11
 *                       text: "請描述您對 AI 系統的改進建議"
 *                       type: "TEXT"
 *                       category: "Transparency"
 *                     value: null
 *                     option: null
 *                     textValue: "希望能更清楚解釋決策原因"
 *       404:
 *         description: Response not found
 */
router.get('/id/:id', responseController.getResponseById);

/**
 * @openapi
 * /api/response/user/{userId}:
 *   get:
 *     summary: Get all responses by a specific user
 *     tags: [Response]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: List of all responses by this user
 */
router.get('/user/:userId', responseController.getResponsesByUserId);

/**
 * @openapi
 * /api/response/project/{projectId}:
 *   get:
 *     summary: Get all responses under a specific project
 *     tags: [Response]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 2
 *     responses:
 *       200:
 *         description: List of all responses under this project
 */
router.get('/project/:projectId', responseController.getResponsesByProjectId);

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
 * /api/response/{id}:
 *   patch:
 *     summary: Update an existing response (answers)
 *     tags: [Response]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: integer
 *                     value:
 *                       type: integer
 *                     textValue:
 *                       type: string
 *                     optionId:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Response updated successfully
 */
router.patch('/:id', responseController.updateResponse);

/**
 * @openapi
 * /api/response/{id}:
 *   delete:
 *     summary: Delete a specific response
 *     tags: [Response]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 15
 *     responses:
 *       200:
 *         description: Response deleted successfully
 */
router.delete('/:id', responseController.deleteResponse);

export default router;
