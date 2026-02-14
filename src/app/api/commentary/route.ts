import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  if (!openai) {
    return NextResponse.json({ line: null }, { status: 200 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { eventType, attackerName, targetName, action, amount } = body as {
      eventType: string;
      attackerName?: string;
      targetName?: string;
      action?: string;
      amount?: number;
    };

    const context =
      eventType === "attack"
        ? `${attackerName} hit ${targetName} with ${action}`
        : eventType === "damage"
          ? `${targetName} took ${amount} damage`
          : eventType === "death"
            ? `${targetName} was knocked out`
            : eventType === "battleStart"
              ? "battle is starting"
              : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content:
            "You are an enthusiastic sports commentator for a silly drawing battle game. Reply in ONE short sentence only (max 12 words). Be funny, excited, and brief. No quotes.",
        },
        {
          role: "user",
          content: `Comment on this: ${context}`,
        },
      ],
    });

    const line = completion.choices[0]?.message?.content?.trim();
    if (!line) return NextResponse.json({ line: null }, { status: 200 });

    return NextResponse.json({ line });
  } catch (err) {
    console.warn("Commentary API error:", err);
    return NextResponse.json({ line: null }, { status: 200 });
  }
}
