import { NextResponse } from 'next/server';
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const analysisSchema = z.object({
  type: z.enum(["food", "restaurant", "location"]),
  suggestions: z.array(z.string()),
}).transform((data) => ({
  analysis: {
    type: data.type,
    suggestions: data.suggestions,
  }
}));

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 2MB limit' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    // Add base64 validation check
    const decodedBuffer = Buffer.from(base64Image, 'base64');
    const isBase64Valid = decodedBuffer.length === buffer.byteLength;

    if (!isBase64Valid) {
      return NextResponse.json({ error: 'Invalid base64 encoding' }, { status: 400 });
    }

    // Step 1: Initial image analysis
    const initialResult = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: 'system',
          content: "You are an AI image analyzer specializing in food, restaurants, and locations.",
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: "What's in this image?" },
            {
              type: 'image',
              image: base64Image,
            },
          ],
        },
      ],
    });

    // Step 2: Specialized analysis
    const specializedResult = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: 'system',
          content: "You are an AI image analyzer specializing in food, restaurants, and locations.",
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Based on this description of an image: "${initialResult.text}", determine if it's food, a restaurant, or a location. If it's food, suggest similar dishes (with the first dish being your best take at what the image is). If it's a restaurant, suggest top 5 most popular menu items from that restaurant or one like it. If it's a location, suggest 5 appropriate food items for that location in order of popularity. Respond in JSON format with 'type' and 'suggestions' fields.` },
          ],
        },
      ],
    });

    // Clean and parse the result
    const cleanedResult = cleanAndParseJSON(specializedResult.text);
    
    // Validate the parsed result
    const validatedResult = analysisSchema.parse(cleanedResult);

    // Return the validated result as JSON
    return NextResponse.json(validatedResult);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: `An error occurred while analyzing the image: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}

// Helper function to clean and parse JSON
function cleanAndParseJSON(text: string): any {
  // Remove Markdown code block syntax
  const cleanedText = text.replace(/```json\s?|\s?```/g, '').trim();
  
  try {
    // Attempt to parse the cleaned text
    return JSON.parse(cleanedText);
  } catch (error) {
    // If parsing fails, attempt to extract JSON using regex
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        throw new Error('Unable to parse the analysis result');
      }
    } else {
      throw new Error('No valid JSON found in the analysis result');
    }
  }
}