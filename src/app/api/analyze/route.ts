import { NextRequest, NextResponse } from "next/server";
import { analyzeDrawing, fallbackFighterConfig } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData, inkSpent } = body;

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid imageData" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "[analyze] No OPENAI_API_KEY - using fallback. Set OPENAI_API_KEY in production!"
      );
      return NextResponse.json(fallbackFighterConfig());
    }

    const config = await analyzeDrawing(imageData, inkSpent || 100);
    return NextResponse.json(config);
  } catch (error) {
    console.error("[analyze] AI analysis failed:", error);
    return NextResponse.json(fallbackFighterConfig());
  }
}
