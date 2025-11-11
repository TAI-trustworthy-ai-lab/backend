// src/routes/questionnaireRoutes.ts

// questionnaire api routes
// POST /api/questionnaire → 建立新問卷版本
// GET /api/questionnaire/:id → 取得某版本（舊路徑，兼容用）
// GET /api/questionnaire-group/latest → 取得三個階段最新版本的 id
// GET /api/questionnaire-version/:id → 取得該版本的問卷內容

/**
 * @openapi
 * tags:
 *   name: Questionnaire
 *   description: APIs for managing questionnaires
 *
 * /api/questionnaire:
 *   post:
 *     summary: Create a new questionnaire version
 *     tags: [Questionnaire]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupName:
 *                 type: string
 *                 example: 建模中
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
 *                       example: RELIABILITY
 *                     order:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Questionnaire version created
 *
 * /api/questionnaire/{id}:
 *   get:
 *     summary: Get questionnaire version by ID
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Questionnaire version details
 *
 * /api/questionnaire/group/latest:
 *   get:
 *     summary: Get all questionnaire groups with latest active version
 *     tags: [Questionnaire]
 *     responses:
 *       200:
 *         description: List of groups with latest versions
 *
 * /api/questionnaire/version/{id}:
 *   get:
 *     summary: Get questionnaire version detail by ID
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Questionnaire version detail
 */

import express from 'express';
import * as questionnaireController from '../controllers/questionnaireController';

const router = express.Router();

// create questionnaire version
// 建立新版本
router.post('/', questionnaireController.createQuestionnaire);

// get questionnaire by its ID
// 兼容舊路徑：/api/questionnaire/:id
router.get('/:id', questionnaireController.getQuestionnaireById);

// get all questionnaire groups with their latest version
// 取得所有 Group + 最新版本 → login 後「建模前/中/後 選擇頁」用
router.get(
  '/group/latest',
  questionnaireController.getLatestQuestionnaireGroups,
);

// 明確用 version id 取得問卷內容
// /api/questionnaire/version/:id
router.get(
  '/version/:id',
  questionnaireController.getQuestionnaireVersionById,
);

export default router;
