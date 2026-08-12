import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoint for Gemini AI Financial Diagnosis
  app.post("/api/ai-diagnostic", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "No se encontró GEMINI_API_KEY en las variables de entorno. Por favor configúrala en el panel de Secretos."
        });
      }

      const { netWorth, baseCurrency, accounts, transactionsCount, monthlyIncome, monthlyExpense, budgets, topExpenseCategory } = req.body;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
Eres un asesor financiero experto y analista contable para la aplicación FinanzasSZ.
Analiza la siguiente información financiera resumida del usuario y proporciona un informe diagnóstico ejecutivo estructurado, claro, alentador e ingenioso en español:

DATOS FINANCIEROS ACTUALES:
- Patrimonio Neto Total: ${netWorth} ${baseCurrency}
- Número de Cuentas: ${accounts ? accounts.length : 0}
- Total de Transacciones Registradas: ${transactionsCount || 0}
- Ingresos de este mes: ${monthlyIncome || 0} ${baseCurrency}
- Gastos de este mes: ${monthlyExpense || 0} ${baseCurrency}
- Categoría de Mayor Gasto: ${topExpenseCategory || 'No determinada'}
- Presupuesto Total Configurado: ${JSON.stringify(budgets || {})}

FORMATO REQUERIDO DEL DIAGNÓSTICO:
1. 📊 ESTADO ACTUAL & SALUD PATRIMONIAL: Diagnóstico breve de balance y liquidez.
2. ⚠️ PUNTOS DE ATENCIÓN Y CONTROL DE GASTOS: Análisis de margen de ahorro y categorías críticas.
3. 💡 RECOMENDACIONES CLAVE Y ESTRATEGIA DE AHORRO: 3 a 4 acciones prácticas para optimizar presupuesto e inversiones.
4. 🎯 OBJETIVO FINANCIERO SUGERIDO: Un hábito financiero semanal o mensual.

Mantén un tono profesional, accesible, positivo y libre de tecnicismos confusos. Usa formato con viñetas y emojis funcionales.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      const diagnosticText = response.text || "No se pudo generar el diagnóstico.";
      return res.json({ diagnostic: diagnosticText });
    } catch (err: any) {
      console.error("Error generating AI diagnostic:", err);
      return res.status(500).json({
        error: "Error al comunicarse con Gemini AI: " + (err.message || "Error interno")
      });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FinanzasSZ Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
