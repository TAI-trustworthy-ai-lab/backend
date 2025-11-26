import { Chart, registerables } from "chart.js";
import { createCanvas } from "canvas";
import fs from "fs";

Chart.register(...registerables);

export function generateRadar(scores: Record<string, number>, outPath: string) {
  const canvas = createCanvas(700, 700);
  const ctx = canvas.getContext("2d");

  new Chart(ctx as any, {
    type: "radar",
    data: {
      labels: Object.keys(scores),
      datasets: [
        {
          label: "Score",
          data: Object.values(scores),
          fill: true,
          backgroundColor: "rgba(54,162,235,0.2)",
          borderColor: "rgb(54,162,235)",
        },
      ],
    },
    options: { responsive: false, animation: false },
  });

  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
}
