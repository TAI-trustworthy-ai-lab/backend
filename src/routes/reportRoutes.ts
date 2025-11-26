import express from "express";
import {
    generateReport,
    getReportByResponseId,
    addReportImage,
} from "../controllers/reportController";

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
 */
router.post("/generate/:responseId", generateReport);

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
router.get("/response/:responseId", getReportByResponseId);

/**
 * @openapi
 * /api/report/{reportId}/image:
 *   post:
 *     summary: Add an image to a report
 *     tags: [Report]
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               caption:
 *                 type: string
 *     responses:
 *       201:
 *         description: Image added
 */
router.post("/:reportId/image", addReportImage);

export default router;
