/**
 * @openapi
 * tags:
 *   name: Project
 *   description: APIs for managing user projects and TAI priorities
 *
 * /api/project:
 *   post:
 *     summary: Create a new project for a user
 *     tags: [Project]
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
 *               name:
 *                 type: string
 *                 example: "AI 系統建模前評估"
 *               description:
 *                 type: string
 *                 example: "這是建模前的第一階段專案"
 *     responses:
 *       201:
 *         description: Project created successfully
 *
 * /api/project/user/{userId}:
 *   get:
 *     summary: Get all projects for a specific user
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: List of user's projects
 *
 * /api/project/{id}:
 *   get:
 *     summary: Get a single project by ID
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Project detail
 *
 * /api/project/{id}/tai-priority:
 *   get:
 *     summary: Get TAI priorities for a project
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: List of TAI priorities for this project
 *   put:
 *     summary: Update TAI priorities for a project
 *     tags: [Project]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 indicator:
 *                   type: string
 *                   example: RELIABILITY
 *                 rank:
 *                   type: integer
 *                   example: 1
 *                 weight:
 *                   type: number
 *                   example: 0.2
 *     responses:
 *       200:
 *         description: TAI priorities updated
 */

import express from 'express';
import * as projectController from '../controllers/projectController';

const router = express.Router();

router.post('/', projectController.createProject);
router.get('/user/:userId', projectController.getProjectsByUser);
router.get('/:id', projectController.getProjectById);
router.get('/:id/tai-priority', projectController.getProjectTAI);
router.put('/:id/tai-priority', projectController.updateProjectTAI);

export default router;
