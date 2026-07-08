import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in .env.local");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const OPENAI_MODEL =
  process.env.OPENAI_CARE_PLAN_MODEL || "gpt-4o-mini";
