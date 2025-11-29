import { Request, Response } from "express";
import { generatePDFBuffer } from "../services/pdfService";

export const generatePDF = async (req: Request, res: Response) => {
  try {
    const { radarImage, radarData, analysisText, overallScore } = req.body;

    if (!radarImage || !radarData || !analysisText) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: radarImage, radarData or analysisText",
      });
    }

    const pdfBuffer = await generatePDFBuffer({
      radarImage,
      radarData,
      analysisText,
      overallScore,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
    res.send(pdfBuffer);

  } catch (error: any) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate PDF",
    });
  }
};
