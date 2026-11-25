import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

let genAI = null;

export function getGenAI() {
  if (!genAI) {
    if (!env.geminiApiKey) {
      const err = new Error("GEMINI_API_KEY is not configured on the server");
      err.status = 500;
      throw err;
    }
    genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return genAI;
}

export function resetGenAI() {
  genAI = null;
}

function classifyGeminiError(error) {
  const message = error?.message ?? String(error);
  const lower = message.toLowerCase();
  const code = Number(error?.status ?? error?.code);
  console.error("Gemini error:", code || "", message.slice(0, 500));

  const make = (text, status) => {
    const err = new Error(text);
    err.status = status;
    return err;
  };

  if (
    code === 404 ||
    (lower.includes("model") && (lower.includes("not found") || lower.includes("invalid")))
  ) {
    return make(
      "Gemini API model is invalid or not available. Check GEMINI_MODEL configuration.",
      400,
    );
  }
  if (
    code === 401 ||
    code === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("authentication") ||
    lower.includes("permission denied")
  ) {
    return make("Gemini API authentication failed. Check your API key configuration.", 401);
  }
  if (code === 429 || lower.includes("quota") || lower.includes("rate limit")) {
    return make("Gemini API rate limit exceeded. Please try again later.", 429);
  }
  if (
    code === 503 ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("timeout")
  ) {
    return make("Gemini API connection failed. Please check your network and try again.", 503);
  }
  return make(`Gemini API error: ${message.slice(0, 200)}`, 500);
}

const EXTRACT_PROMPT = `You are an assistant that extracts event information from music event flyers.
Analyze the image and return a JSON object with the following fields:

- title: Event title (string)
- artists: Array of performer/artist names (string array)
- venue: Venue name (string)
- city: City name (string)
- event_date: Event start date in ISO format YYYY-MM-DD (string)
- event_time: Event start time in HH:MM 24-hour format (string)
- event_end_date: Event end date in ISO format YYYY-MM-DD (string)
- event_end_time: Event end time in HH:MM 24-hour format (string)
- host: Event host or organizer (string)
- ticket_price: Ticket price information (string)
- booking_info: Booking or contact information (string)
- description: Short description of the event based on what is visible on the flyer (string)

Rules:
- Only include fields you can see or reasonably infer from the flyer.
- If a field is not visible, set it to null (do not omit it).
- Return ONLY valid JSON, no markdown code fences, no extra text.
- For dates, convert relative dates (e.g., "this Friday") to an absolute date based on the context; if unsure, set to null.
- For times, use 24-hour format (e.g., "19:00").
- Never invent event information that is not visible on the flyer.`;

const DESCRIPTION_PROMPT_TEMPLATE = (details) => `Write a professional, engaging event description for a music event with the following details:

${Object.entries(details)
  .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
  .join("\n")}

The description should:
- Be written in an inviting, promotional tone suitable for a music event
- Be 2-4 short paragraphs
- Include a clear call to action
- Not invent details not provided above
- Return ONLY the description text, no markdown code fences, no extra commentary.`;

export async function extractEventFromImage(imageBuffer, mimeType) {
  const ai = getGenAI();
  const base64Image = imageBuffer.toString("base64");

  let interaction;
  try {
    interaction = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: EXTRACT_PROMPT },
            { inlineData: { data: base64Image, mime_type: mimeType } },
          ],
        },
      ],
    });
  } catch (error) {
    throw classifyGeminiError(error);
  }

  const text = (interaction.text ?? "").trim();

  const cleaned = text
    .replace(/^```json\s*/, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      const err = new Error("Gemini returned invalid event data: expected a JSON object");
      err.status = 400;
      throw err;
    }
    return parsed;
  } catch (parseError) {
    if (parseError.message.startsWith("Gemini returned invalid event data")) {
      throw parseError;
    }
    const err = new Error(
      `Gemini returned non-JSON response: ${cleaned.slice(0, 200)}`,
    );
    err.status = 400;
    throw err;
  }
}

export async function generateEventDescription(eventDetails) {
  const ai = getGenAI();
  const prompt = DESCRIPTION_PROMPT_TEMPLATE(eventDetails);

  let interaction;
  try {
    interaction = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
  } catch (error) {
    throw classifyGeminiError(error);
  }

  const description = (interaction.text ?? "").trim();
  if (!description) {
    const err = new Error("Gemini returned an empty event description");
    err.status = 400;
    throw err;
  }
  return description;
}
