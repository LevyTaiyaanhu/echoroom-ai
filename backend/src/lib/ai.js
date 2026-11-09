import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

let genAI = null;
let model = null;

function getModel() {
  if (!genAI) {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured on the server");
    }
    genAI = new GoogleGenerativeAI(env.geminiApiKey);
    model = genAI.getGenerativeModel({ model: env.geminiModel });
  }
  return model;
}

const EXTRACT_PROMPT = `
You are an assistant that extracts event information from music event flyers.
Analyze the image and return a JSON object with the following fields where the information is visible or can be reasonably inferred:

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
- If a field is not visible, omit it from the JSON (do not use null).
- Return ONLY valid JSON, no markdown code fences, no extra text.
- For dates, convert relative dates (e.g., "this Friday") to an absolute date based on the context; if unsure, omit.
- For times, use 24-hour format (e.g., "19:00").
`;

const DESCRIPTION_PROMPT_TEMPLATE = (details) => `
Write a professional, engaging event description for a music event with the following details:

${Object.entries(details)
  .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
  .join("\n")}

The description should:
- Be written in an inviting, promotional tone suitable for a music event
- Be 2-4 short paragraphs
- Include a clear call to action
- Not invent details not provided above
- Return ONLY the description text, no markdown code fences, no extra commentary.
`;

export async function extractEventFromImage(imageBuffer, mimeType) {
  const m = getModel();
  const base64Image = imageBuffer.toString("base64");

  const result = await m.generateContent([
    EXTRACT_PROMPT,
    { inlineData: { data: base64Image, mimeType } },
  ]);

  const response = await result.response;
  const text = response.text().trim();

  const cleaned = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(`Gemini returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }
}

export async function generateEventDescription(eventDetails) {
  const m = getModel();
  const prompt = DESCRIPTION_PROMPT_TEMPLATE(eventDetails);

  const result = await m.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}
