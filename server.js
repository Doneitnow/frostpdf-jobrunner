import express from "express";
import cors from "cors";
import multer from "multer";
import bodyParser from "body-parser";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(bodyParser.json());
const upload = multer({ dest: "/tmp/uploads" });

const PORT = process.env.PORT || 10000;
const RUNNER_TOKEN = process.env.RUNNER_TOKEN || "change_me";
const TMP_DIR = process.env.TMP_DIR || "/tmp";

app.use((req, res, next) => {
  const token = req.headers["x-runner-token"];
  if (token !== RUNNER_TOKEN) return res.status(403).json({ error: "Unauthorized" });
  next();
});

app.get("/", (req, res) => res.json({ status: "FrostPDF Job Runner Online ✅" }));

app.post("/run", upload.any(), async (req, res) => {
  try {
    const { op, inputs } = req.body;
    if (!op) return res.status(400).json({ error: "Missing operation" });

    if (op === "compress") {
      const input = inputs[0];
      const output = path.join(TMP_DIR, `compressed_${Date.now()}.pdf`);
      exec(`gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${output} ${input}`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ download: output });
      });
    } else if (op === "office2pdf") {
      const input = inputs[0];
      const outDir = path.join(TMP_DIR, `office_${Date.now()}`);
      fs.mkdirSync(outDir, { recursive: true });
      exec(`soffice --headless --convert-to pdf --outdir ${outDir} ${input}`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        const pdfOut = fs.readdirSync(outDir).find(f => f.endsWith(".pdf"));
        return res.json({ download: path.join(outDir, pdfOut) });
      });
    } else if (op === "ocr") {
      const input = inputs[0];
      const output = path.join(TMP_DIR, `ocr_${Date.now()}.pdf`);
      exec(`tesseract ${input} ${output.replace(".pdf", "")} pdf`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ download: output });
      });
    } else {
      return res.status(400).json({ error: "Unknown operation" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ FrostPDF Job Runner running on port ${PORT}`));
