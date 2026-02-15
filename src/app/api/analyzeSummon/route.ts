import { NextRequest, NextResponse } from "next/server";
import { analyzeDrawing } from "@/lib/ai";

/**
 * API endpoint to analyze a summoned fighter drawing
 */
export async function POST(request: NextRequest) {
  try {
    const { imageData, inkSpent } = await request.json();

    if (!imageData) {
      return NextResponse.json({ error: "Missing imageData" }, { status: 400 });
    }

    // Analyze the drawing using AI
    // Use provided inkSpent or default to 80 for summoned fighters
    const config = await analyzeDrawing(imageData, inkSpent ?? 80);

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error analyzing summon:", error);
    return NextResponse.json(
      { error: "Failed to analyze drawing" },
      { status: 500 }
    );
  }
}
