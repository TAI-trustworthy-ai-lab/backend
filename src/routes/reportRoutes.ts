import express from 'express';
import * as reportController from '../controllers/reportController';

const router = express.Router();

/**
 * @openapi
 * /api/report/generate/{responseId}:
 *   post:
 *     summary: Generate a report from a specific response
 *     tags: [Report]
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Report generated successfully
 *
 */
router.post('/generate/:responseId', reportController.generateReport);

/**
 * @openapi
 * /api/report/response/{responseId}:
 *   get:
 *     summary: Get a report by responseId
 *     tags: [Report]
 *     parameters:
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report found
 *       404:
 *         description: Report not found
 */
router.get('/response/:responseId', reportController.getReportByResponseId);


export default router;
