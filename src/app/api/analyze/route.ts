import { NextRequest, NextResponse } from "next/server";
import { analyzeDrawing, fallbackFighterConfig } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData } = body;

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid imageData" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      // Return a fallback config for development without API key
      console.warn("No OpenAI API key configured, using fallback fighter config");
      return NextResponse.json(fallbackFighterConfig());
    }

    const config = await analyzeDrawing(imageData);
    return NextResponse.json(config);
  } catch (error) {
    console.error("AI analysis failed:", error);
    // Return fallback on error
    return NextResponse.json(fallbackFighterConfig());
  }
}
