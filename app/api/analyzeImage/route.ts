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
  console.log('POST function called');
  try {
    const formData = await req.formData();
    console.log('FormData received');

    const file = formData.get('image') as File;
    console.log('File object:', file);

    if (!file) {
      console.log('No file uploaded');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('File received:', file.name, file.type, file.size);

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      console.log('File size exceeds limit');
      return NextResponse.json({ error: 'File size exceeds 2MB limit' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    console.log('ArrayBuffer created');

    const base64Image = Buffer.from(buffer).toString('base64');
    console.log('Base64 image created');

    // Add base64 validation check
    const decodedBuffer = Buffer.from(base64Image, 'base64');
    const isBase64Valid = decodedBuffer.length === buffer.byteLength;
    console.log('Is base64 encoding valid?', isBase64Valid);

    // Step 1: Initial image analysis
    const initialResult = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
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

    console.log('Initial analysis:', initialResult.text);

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
            { type: 'text', text: `Based on this description of an image: "${initialResult.text}", determine if it's food, a restaurant, or a location. If it's food, suggest similar dishes. If it's a restaurant, suggest menu items. If it's a location, suggest appropriate food items for that location. Respond in JSON format with 'type' and 'suggestions' fields.` },
          ],
        },
      ],
    });

    console.log('Specialized analysis:', specializedResult.text);

    // Clean and parse the result
    const cleanedResult = cleanAndParseJSON(specializedResult.text);
    
    console.log('Cleaned and parsed result:', cleanedResult);

    // Validate the parsed result
    const validatedResult = analysisSchema.parse(cleanedResult);

    console.log('Validated result:', validatedResult);

    // Return the validated result as JSON
    return NextResponse.json(validatedResult);
  } catch (error) {
    console.error('Error in POST function:', error);
    return NextResponse.json({ error: `An error occurred while analyzing the image: ${error.message}` }, { status: 500 });
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
    console.error('Error parsing JSON:', error);
    
    // If parsing fails, attempt to extract JSON using regex
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        console.error('Error parsing extracted JSON:', innerError);
        throw new Error('Unable to parse the analysis result');
      }
    } else {
      throw new Error('No valid JSON found in the analysis result');
    }
  }
}