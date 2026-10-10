
import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "30kb" }));
app.use(express.static(path.join(__dirname, "public")));

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const MODEL = "llama-3.3-70b-versatile";

const allowedTypes = [
  "Essay",
  "Story",
  "Email",
  "Letter",
  "Blog post",
  "Social media post",
  "Speech",
  "Summary",
  "Poem",
  "General writing"
];

const allowedTones = [
  "Friendly",
  "Professional",
  "Creative",
  "Formal",
  "Simple",
  "Persuasive",
  "Funny"
];

const allowedLengths = [
  "Short",
  "Medium",
  "Long"
];

const allowedLanguages = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Simple English"
];

async function askAI(messages) {
  if (!process.env.GROQ_API_KEY) {
    const error = new Error(
      "The server API key is not configured."
    );
    error.status = 503;
    throw error;
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2500
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("AI provider error:", response.status, details);

    const error = new Error(
      response.status === 429
        ? "Too many requests. Please wait and try again."
        : "The writing service could not complete your request."
    );

    error.status =
      response.status === 429 ? 429 : 502;

    throw error;
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim();

  if (!result) {
    const error = new Error("No text was returned. Please try again.");
    error.status = 502;
    throw error;
  }

  return result;
}

app.post("/api/write", async (req, res) => {
  try {
    const {
      prompt,
      type = "General writing",
      tone = "Friendly",
      length = "Medium",
      language = "English"
    } = req.body ?? {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Please enter what you want to write."
      });
    }

    if (prompt.length > 8000) {
      return res.status(400).json({
        error: "Your prompt is too long. Keep it under 8,000 characters."
      });
    }

    const safeType = allowedTypes.includes(type)
      ? type : "General writing";

    const safeTone = allowedTones.includes(tone)
      ? tone : "Friendly";

    const safeLength = allowedLengths.includes(length)
      ? length : "Medium";

    const safeLanguage = allowedLanguages.includes(language)
      ? language : "English";

    const result = await askAI([
      {
        role: "system",
        content:
          "You are Writer AI, a helpful writing assistant. " +
          "Create original, clear, useful writing based on the user's request. " +
          "Follow the requested format, tone, length, and language. " +
          "Do not claim that generated facts have been verified. " +
          "When a school assignment is requested, help the student learn and " +
          "understand the topic; do not invent sources or quotations."
      },
      {
        role: "user",
        content:
          `Writing type: ${safeType}\n` +
          `Tone: ${safeTone}\n` +
          `Length: ${safeLength}\n` +
          `Language: ${safeLanguage}\n\n` +
          `User's request:\n${prompt.trim()}`
      }
    ]);

    res.json({ text: result });
  } catch (error) {
    console.error("Write error:", error.message);

    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Something went wrong. Please try again."
    });
  }
});

app.post("/api/rewrite", async (req, res) => {
  try {
    const { text, instruction = "Improve the writing" } =
      req.body ?? {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "There is no text to rewrite."
      });
    }

    if (text.length > 12000) {
      return res.status(400).json({
        error: "The text is too long to rewrite at once."
      });
    }

    if (
      typeof instruction !== "string" ||
      instruction.length > 300
    ) {
      return res.status(400).json({
        error: "Please enter a shorter rewrite instruction."
      });
    }

    const result = await askAI([
      {
        role: "system",
        content:
          "You are a careful writing editor. Rewrite the provided text " +
          "according to the user's editing instruction. Preserve its intended " +
          "meaning unless asked to change it. Return only the revised text."
      },
      {
        role: "user",
        content:
          `Editing instruction: ${instruction.trim() || "Improve the writing"}\n\n` +
          `Text to edit:\n${text.trim()}`
      }
    ]);

    res.json({ text: result });
  } catch (error) {
    console.error("Rewrite error:", error.message);

    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Something went wrong. Please try again."
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Writer AI running on port ${PORT}`);
});
