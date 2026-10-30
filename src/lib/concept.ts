// Server-only concept agent: turns product info + creator niche into a pitch concept.
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

export type Niche = "travel" | "wellness" | "fashion" | "maker" | "beauty" | "other";

const ConceptSchema = z.object({
  hooks: z.array(z.string().min(1)).length(3),
  shotList: z.array(z.string().min(1)).length(5),
  pitchEmail: z.string().min(1),
});

export type Concept = z.infer<typeof ConceptSchema>;

const MODEL = "gemini-3.5-flash-lite";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

export async function generateConcept(
  productName: string,
  productDescription: string,
  niche: Niche
): Promise<Concept> {
  const ai = client();

  const prompt = `You are a UGC (user-generated content) creator strategist helping a creator pitch a brand deal.

Product name: ${productName}
Product description: ${productDescription}
Creator niche: ${niche}

Write a pitch concept for a brand partnership. The creator has NOT shot any content yet — this is a concept pitch, not finished content. Make the creator's personal connection to the product in their niche (${niche}) explicit and specific, not generic.

Return:
- hooks: exactly 3 short, scroll-stopping opening lines/hooks for a short-form video, tailored to the "${niche}" niche
- shotList: exactly 5 concise shot ideas for the video
- pitchEmail: a 2-3 sentence pitch email to the brand. It must explicitly state the creator's personal connection to the product and their niche. It must also include a line clearly stating this is a concept preview and that final content will be shot with the real product, something like: "This is a concept preview. Final content will be shot with the real product."`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
          shotList: { type: Type.ARRAY, items: { type: Type.STRING } },
          pitchEmail: { type: Type.STRING },
        },
        required: ["hooks", "shotList", "pitchEmail"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Concept agent returned no content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Concept agent returned invalid JSON");
  }

  const result = ConceptSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Concept agent response failed validation: ${result.error.message}`);
  }
  return result.data;
}
