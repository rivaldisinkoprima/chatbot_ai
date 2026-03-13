const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Satpam 1: Validasi API Key (Startup Phase)
if (
  !process.env.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY === "YOUR_API_KEY_HERE"
) {
  console.error("ERROR: GEMINI_API_KEY is not configured in .env file");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const forbiddenWords = ["kasar", "negatif", "sara", "spam", "jahat"];

function containsForbiddenWords(text) {
  const lowerText = text.toLowerCase();
  return forbiddenWords.some((word) => lowerText.includes(word));
}

let conversationHistory = [];

const SYSTEM_PROMPT =
  "Kamu adalah asisten yang selalu menjawab dalam bahasa Indonesia Slang (Bahasa Indonesia Gauk). Jawablah semua pertanyaan pengguna menggunakan bahasa Indonesia Slang yang modern gaul di indonesia.sertakan juga emoticon agar lebih obrolan lebih bervariasi dan menarik.";

async function generateResponse(prompt) {
  // Satpam 5: Integritas Struktur Riwayat Percakapan (Context Phase)
  if (!Array.isArray(conversationHistory)) {
    console.warn("Warning: conversationHistory is not an array, resetting.");
    conversationHistory = [];
  } else {
    conversationHistory = conversationHistory.filter((entry, index) => {
      try {
        if (typeof entry !== "object" || entry === null) return false;
        if (
          typeof entry.role !== "string" ||
          !["user", "model"].includes(entry.role)
        )
          return false;
        if (!Array.isArray(entry.parts) || entry.parts.length === 0)
          return false;
        if (typeof entry.parts[0].text !== "string") return false;
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Apa kang kudu tak lakoni?" }] },
      ...conversationHistory,
    ],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
    },
  });

  // Satpam 6: Mekanisme Timeout Koneksi (Connectivity Phase)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error("Request timed out after 15 seconds")),
      15000,
    ),
  );

  const result = await Promise.race([chat.sendMessage(prompt), timeoutPromise]);

  // Satpam 7: Integritas Respons & Safety Filter AI (Output Phase)
  if (!result || !result.response) {
    throw new Error("AI Model returned an empty response");
  }

  const responseText = result.response.text();

  if (!responseText || responseText.trim() === "") {
    throw new Error("Pesan diblokir oleh filter keamanan AI (Safety Filter).");
  }

  conversationHistory.push({ role: "user", parts: [{ text: prompt }] });
  conversationHistory.push({ role: "model", parts: [{ text: responseText }] });

  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }

  return responseText;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // Satpam 2: Validasi Payload & Tipe Data Input (Entry Phase)
    if (
      message === undefined ||
      message === null ||
      typeof message !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "Valid message string is required" });
    }

    const trimmedMessage = message.trim();

    // Satpam 3: Filter Kata Terlarang / Blacklist (Content Security Phase)
    if (containsForbiddenWords(trimmedMessage)) {
      return res.status(400).json({
        error: "Pesan Anda mengandung kata-kata yang tidak diperbolehkan.",
      });
    }

    // Satpam 4: Batasan Karakter & Volume Input (Volume Control Phase)
    if (trimmedMessage === "" || trimmedMessage.length > 2000) {
      return res.status(400).json({
        error: "Message length must be between 1 and 2000 characters",
      });
    }

    const reply = await generateResponse(trimmedMessage);
    res.json({ reply });
  } catch (error) {
    console.error("Error:", error.message);
    const statusCode = error.message.includes("timeout") ? 504 : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

app.post("/api/reset", (req, res) => {
  conversationHistory = [];
  res.json({ message: "Conversation history cleared" });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
