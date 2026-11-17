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

/**
 * Classify Gemini SDK errors into safe, user-facing messages.
 * Never leak the API key or raw stack details to the caller.
 */
function classifyGeminiError(error) {
  const message = error?.message ?? String(error);

  if (message.includes("API key") || message.includes("authentication") || message.includes("401") || message.includes("403")) {
    const err = new Error(
      "Gemini API authentication failed. Check your API key configuration.",
    );
    err.status = 401;
    return err;
  }
  if (message.includes("quota") || message.includes("rate limit") || message.includes("429")) {
    const err = new Error(
      "Gemini API rate limit exceeded. Please try again later.",
    );
    err.status = 429;
    return err;
  }
  if (message.includes("model") && (message.includes("not found") || message.includes("invalid"))) {
    const err = new Error(
      "Gemini API model is invalid or not available. Check GEMINI_MODEL configuration.",
    );
    err.status = 400;
    return err;
  }
  if (message.includes("network") || message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT") || message.includes("timeout")) {
    const err = new Error(
      "Gemini API connection failed. Please check your network and try again.",
    );
    err.status = 503;
    return err;
  }
  const err = new Error(`Gemini API error: ${message.slice(0, 200)}`);
  err.status = 500;
  return err;
}

const EXTRACT_PROMPT = `You are an assistant that extracts event information from music event flyers.
Analyze the image and return a JSON object with the following fields:

- title: Event title (string)
- artists: Array of performer/artist names (string array)
- venue: Venue name (string)
- city: City name (string)
- event_date: Event date in ISO format YYYY-MM-DD (string)
- event_time: Event time in HH:MM 24-hour format (string)
- host: Event host or organizer (string)
- ticket_price: Ticket price information (string)
- booking_info: Booking or contact information (string)

Rules:
- Only include fields you can see or reasonably infer from the flyer.
- If a field is not visible, set it to null (do not omit it).
- Return ONLY valid JSON, no markdown code fences, no extra text.
- For dates, convert relative dates (e.g., "this Friday") to an absolute date based on the context; if unsure, set to null.
- For times, use 24-hour format (e.g., "19:00").`;

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

  let response;
  try {
    response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: EXTRACT_PROMPT },
            { inlineData: { data: base64Image, mimeType } },
          ],
        },
      ],
    });
  } catch (error) {
    throw classifyGeminiError(error);
  }

  const text = (response.text ?? "").trim();

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

  let response;
  try {
    response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });
  } catch (error) {
    throw classifyGeminiError(error);
  }

  const description = (response.text ?? "").trim();
  if (!description) {
    const err = new Error("Gemini returned an empty event description");
    err.status = 400;
    throw err;
  }
  return description;
}
