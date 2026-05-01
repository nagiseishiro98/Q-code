import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for NVIDIA Proxy
  app.post("/api/chat", async (req, res) => {
    const { model, messages, stream, context, isAgentMode } = req.body;
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "NVIDIA_API_KEY is not configured on the server." });
    }

    let systemContent = "You are an expert software engineer.";
    if (isAgentMode) {
      systemContent += " When asked to build an application or feature, act as a Website Maker Agent. You must generate a complete, well-structured file tree. Then, provide the complete, functional, and unimagined code for EVERY file in that tree (no placeholders). Finally, provide precise, step-by-step terminal commands (e.g., npm commands) to install dependencies and run the application on localhost.";
    }
    if (context) {
      systemContent += `\n\nUse the following file contexts to inform your answer:\n\n${context}`;
    }

    // Enhance prompt with context if provided
    const enhancedMessages = [
      { role: "system", content: systemContent }, 
      ...messages
    ];

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: enhancedMessages,
          stream: stream || false,
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Serve context files securely
  app.get("/api/files/:name", async (req, res) => {
    const fileName = req.params.name;
    const allowedFiles = ["SKILLS.md"];
    
    if (!allowedFiles.includes(fileName)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const fs = await import("fs/promises");
      const filePath = path.join(process.cwd(), fileName);
      const content = await fs.readFile(filePath, "utf-8");
      res.json({ content });
    } catch (error) {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
