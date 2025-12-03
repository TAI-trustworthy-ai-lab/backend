import PDFDocument from "pdfkit";
import path from "path";
import { CATEGORY_MAP } from "../utils/categoryMap";

interface PDFInput {
  radarImage: string;
  radarData: Record<string, number>;
  analysisText: string;
  overallScore?: number;
}

// 確保 CATEGORY_MAP 與前端一致（你前端的那份）
export const generatePDFBuffer = async ({
  radarImage,
  radarData,
  analysisText,
  overallScore,
}: PDFInput): Promise<Buffer> => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // 加載中文字型
    const fontPath = path.join(__dirname, "../../fonts/NotoSansTC-Regular.ttf");
    doc.registerFont("NotoSansTC", fontPath);
    doc.font("NotoSansTC");

    // 標題
    doc.fontSize(20).text("Trustworthy AI Assessment Report", { align: "center" });
    doc.moveDown(1);

    // overallScore
    if (overallScore !== undefined) {
      doc.fontSize(14).text(`總體評分（Overall Score）：${(overallScore * 100).toFixed(1)} 分`);
      doc.moveDown(1);
    }

    // Radar 圖片
    doc.fontSize(16).text("雷達圖（Radar Chart）：");
    doc.moveDown(0.5);

    const base64Data = radarImage.replace(/^data:image\/png;base64,/, "");
    const radarImageBuffer = Buffer.from(base64Data, "base64");

    doc.image(radarImageBuffer, {
      fit: [350, 350],
      align: "center",
    });

    doc.moveDown(2);

    // Radar 數據表格
    doc.fontSize(16).text("各指標分數（Radar Data）：");
    doc.moveDown(0.5);
    doc.fontSize(12);

    Object.keys(CATEGORY_MAP).forEach((key) => {
      const chineseLabel = CATEGORY_MAP[key];
      const value = radarData[key] ?? 0;

      doc.text(`${chineseLabel}：${(value * 100).toFixed(1)} 分`);
    });

    doc.moveDown(2);

    // 分析文字
    doc.fontSize(16).text("分析（Analysis）：");
    doc.moveDown(0.5);
    doc.fontSize(12).text(analysisText, {
      align: "left",
    });

    doc.end();
  });
};
