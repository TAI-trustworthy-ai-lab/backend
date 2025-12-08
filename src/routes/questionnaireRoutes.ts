/**
 * @openapi
 * tags:
 *   - name: Questionnaire (Admin)
 *     description: Admin-only APIs for managing questionnaire versions
 *
 * /api/questionnaire:
 *   post:
 *     summary: Create a new questionnaire version (Admin only)
 *     tags: [Questionnaire (Admin)]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupName: { type: string, example: 建模前 }
 *               title: { type: string, example: 建模前 問卷 v1 }
 *               description: { type: string, example: 建模前問卷描述 }
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text: { type: string }
 *                     description: { type: string, example: “題目額外説明”, nullable: true }
 *                     category:
 *                       type: string
 *                       enum: [ACCURACY, RELIABILITY, SAFETY, RESILIENCE, TRANSPARENCY, ACCOUNTABILITY, EXPLAINABILITY, AUTONOMY, PRIVACY, FAIRNESS, SECURITY]
 *                     order: { type: integer }
 *                     type:
 *                       type: string
 *                       enum: [SCALE, SINGLE_CHOICE, MULTIPLE_CHOICE, TEXT]
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           text: { type: string }
 *                           value: { type: number }
 *                           order: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire created successfully
 *
 * /api/questionnaire/{id}:
 *   patch:
 *     summary: Update questionnaire version (Admin only)
 *     tags: [Questionnaire (Admin)]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: 更新後問卷標題 }
 *               description: { type: string, example: 更新後描述 }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Questionnaire version updated
 *
 *   delete:
 *     summary: Delete questionnaire version (Admin only)
 *     tags: [Questionnaire (Admin)]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *         required: true
 *     responses:
 *       200:
 *         description: Questionnaire version deleted
 *
 * /api/questionnaire/{id}/duplicate:
 *   put:
 *     summary: Duplicate questionnaire version (Admin only)
 *     tags: [Questionnaire (Admin)]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *         required: true
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: 複製問卷標題 }
 *               description: { type: string, example: 複製問卷描述 }
 *     responses:
 *       200:
 *         description: Questionnaire duplicated successfully
 */

/**
 * @openapi
 * tags:
 *   - name: Questionnaire (User)
 *     description: User-accessible APIs for retrieving questionnaire versions
 *
 * /api/questionnaire/all:
 *   get:
 *     summary: List all questionnaire versions
 *     tags: [Questionnaire (User)]
 *     parameters:
 *       - in: query
 *         name: groupName
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: includeQuestions
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of questionnaire versions
 *
 * /api/questionnaire/group/latest:
 *   get:
 *     summary: Get latest questionnaire version for each group
 *     tags: [Questionnaire (User)]
 *     responses:
 *       200:
 *         description: Latest group versions retrieved
 *
 * /api/questionnaire/latest:
 *   get:
 *     summary: Get latest version by group name
 *     tags: [Questionnaire (User)]
 *     parameters:
 *       - in: query
 *         name: groupName
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Latest questionnaire version returned
 *
 * /api/questionnaire/version/{id}:
 *   get:
 *     summary: Get questionnaire version by version ID
 *     tags: [Questionnaire (User)]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire version details retrieved
 *
 * /api/questionnaire/{id}:
 *   get:
 *     summary: Get questionnaire details by ID (legacy path)
 *     tags: [Questionnaire (User)]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire retrieved
 */




import express from 'express';
import * as questionnaireController from '../controllers/questionnaireController';
import { protectAuth, protectAdmin } from '../middlewares/authMiddleware';

const router = express.Router();

/**
 * ================================
 *  （Admin 管理問卷版本專用）
 * ================================
 */
// POST /api/questionnaire → 建立新問卷版本（Admin）
router.post('/',protectAuth,protectAdmin,questionnaireController.createQuestionnaire);

// PATCH /api/questionnaire/:id → 修改標題、描述、isActive（Admin）
router.patch('/:id',protectAuth,protectAdmin,questionnaireController.updateQuestionnaire);

// DELETE /api/questionnaire/:id → 刪除問卷版本（Admin）
router.delete('/:id',protectAuth,protectAdmin,questionnaireController.deleteQuestionnaire);

// PUT /api/questionnaire/:id/duplicate → 複製問卷版本（Admin）
router.put('/:id/duplicate',protectAuth,protectAdmin,questionnaireController.duplicateQuestionnaire);

/**
 * ================================
 *  （一般 User 需要用來填寫問卷）
 * ================================
 */

// GET /api/questionnaire/all → 查詢所有問卷（可選擇是否要開放給 user）
router.get('/all', questionnaireController.getAllQuestionnaires);

// GET /api/questionnaire/group/latest → 取得三個階段最新版本
router.get('/group/latest', questionnaireController.getLatestQuestionnaireGroups);

// GET /api/questionnaire/latest?groupName=建模前 → 取得某組最新問卷
router.get('/latest', questionnaireController.getLatestQuestionnaireByGroupName);

// GET /api/questionnaire/version/:id → 明確用 version id 查內容
router.get('/version/:id', questionnaireController.getQuestionnaireVersionById);

// GET /api/questionnaire/:id → 兼容舊路徑，同樣回傳問卷版本內容
router.get('/:id', questionnaireController.getQuestionnaireById);

export default router;
