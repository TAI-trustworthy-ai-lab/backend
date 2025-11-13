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
 *                 example: 建模前
 *               title:
 *                 type: string
 *                 example: 建模前 問卷 v1
 *               description:
 *                 type: string
 *                 example: 評估 AI 系統在建模前階段的信任指標
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text: { type: string, example: 系統是否具備輸入驗證機制？ }
 *                     category:
 *                       type: string
 *                       enum: [ACCURACY, RELIABILITY, SAFETY, RESILIENCE, TRANSPARENCY, ACCOUNTABILITY, EXPLAINABILITY, AUTONOMY, PRIVACY, FAIRNESS, SECURITY]
 *                       example: RELIABILITY
 *                     order: { type: integer, example: 2 }
 *                     type:
 *                       type: string
 *                       enum: [SCALE, SINGLE_CHOICE, MULTIPLE_CHOICE, TEXT]
 *                       example: SINGLE_CHOICE
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           text:  { type: string, example: 是 }
 *                           value: { type: number, example: 1 }
 *                           order: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Questionnaire version created successfully
 *
 *
 * /api/questionnaire/all:
 *   get:
 *     summary: List all questionnaire versions (with optional filters & pagination)
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: query
 *         name: groupName
 *         schema: { type: string, example: 建模中 }
 *         description: Filter by questionnaire group name
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean, example: true }
 *         description: Filter by version active status
 *       - in: query
 *         name: includeQuestions
 *         schema: { type: boolean, example: true }
 *         description: Whether to include questions & options
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, example: 20 }
 *         description: Page size
 *     responses:
 *       200:
 *         description: List of questionnaire versions
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 items:
 *                   - id: 4
 *                     versionNumber: 2
 *                     isActive: true
 *                     title: 建模前 問卷 v2
 *                     group: { id: 1, name: 建模前 }
 *                     questions:
 *                       - id: 11
 *                         text: 模型是否定期更新？
 *                         type: SINGLE_CHOICE
 *                         category: ACCOUNTABILITY
 *                         order: 1
 *                         options:
 *                           - id: 21
 *                             text: 是
 *                             value: 1
 *                           - id: 22
 *                             text: 否
 *                             value: 0
 *                 pagination:
 *                   page: 1
 *                   pageSize: 20
 *                   total: 7
 *                   totalPages: 1
 *
 * /api/questionnaire/{id}:
 *   get:
 *     summary: Get questionnaire version by legacy ID (兼容舊路徑)
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire version details
 * 
 *   patch:
 *     summary: Update questionnaire version (title, description, isActive)
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: 建模前 問卷 v2（修正版）
 *               description:
 *                 type: string
 *                 example: 更新題目描述與權重設定
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Questionnaire version updated successfully
 *
 *   delete:
 *     summary: Delete questionnaire version by ID (包含題目與選項)
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire version deleted successfully
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
 *     summary: Get questionnaire version detail by ID (包含題目與選項)
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire version detail
 * 
 * /api/questionnaire/{id}/duplicate:
 *   put:
 *     summary: Duplicate questionnaire version (copy all questions and options)
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: 建模前 問卷 v3（副本）
 *               description:
 *                 type: string
 *                 example: 從 v2 複製而來的問卷版本
 *     responses:
 *       200:
 *         description: Questionnaire version duplicated successfully
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 id: 5
 *                 title: 建模前 問卷 v3（副本）
 *                 versionNumber: 3
 *                 group: { id: 1, name: 建模前 }
 *                 questions:
 *                   - id: 31
 *                     text: 系統是否具備輸入驗證機制？
 *                     type: SINGLE_CHOICE
 *                     options:
 *                       - text: 是
 *                       - text: 否
 * 
 * /api/questionnaire/latest:
 *   get:
 *     summary: Get latest questionnaire version by groupName
 *     description: 依 "建模前 / 建模中 / 建模後" 取得最新問卷版本（含題目＋選項）
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: query
 *         name: groupName
 *         schema:
 *           type: string
 *           example: 建模前
 *         required: true
 *         description: The name of the questionnaire group
 *     responses:
 *       200:
 *         description: Latest questionnaire version found
 */


import express from 'express';
import * as questionnaireController from '../controllers/questionnaireController';

const router = express.Router();

// POST /api/questionnaire → 建立新問卷版本
router.post('/', questionnaireController.createQuestionnaire);

// PATCH /api/questionnaire/:id → 修改標題、描述、isActive
router.patch('/:id', questionnaireController.updateQuestionnaire);

// DELETE /api/questionnaire/:id → 刪除問卷版本
router.delete('/:id', questionnaireController.deleteQuestionnaire);

// PUT /api/questionnaire/:id/duplicate → 複製問卷版本
router.put('/:id/duplicate', questionnaireController.duplicateQuestionnaire);

// GET /api/questionnaire/all → 查詢所有問卷
router.get('/all', questionnaireController.getAllQuestionnaires);

// GET /api/questionnaire/group/latest → 取得三個階段最新版本
router.get('/group/latest', questionnaireController.getLatestQuestionnaireGroups);

// GET /api/questionnaire/:id → 用問卷版本 id 取得問卷內容
router.get('/latest', questionnaireController.getLatestQuestionnaireByGroupName);

// GET /api/questionnaire/version/:id → 明確用 version id 取得問卷內容
router.get('/version/:id', questionnaireController.getQuestionnaireVersionById);

// GET /api/questionnaire/:id → 舊版路徑（兼容用）
router.get('/:id', questionnaireController.getQuestionnaireById);

export default router;
