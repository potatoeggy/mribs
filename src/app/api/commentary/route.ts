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
        ? `"${attackerName}" (attacker) just hit "${targetName}" (target) with ${action}`
        : eventType === "damage"
          ? attackerName
            ? `"${attackerName}" (attacker) just hit "${targetName}" (target) - ranged/projectile`
            : `"${targetName}" (target) just took a hit`
          : eventType === "death"
            ? `"${targetName}" was just knocked out`
            : eventType === "battleStart"
              ? "battle is starting"
              : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content: `You're a CHAOTIC Gen-Z battle commentator for a silly drawing battle game. Characters have creative names (e.g. "Ferocious Feline", "Ink Demon", "Scribble Dragon").

Rules:
- ONE short line only (max 14 words). NO quotes around your response.
- NEVER mention damage numbers (no "20 damage", "15 hp", etc.). Describe WHAT happened in a creative way.
- Use the CHARACTER NAMES—they're fun! Make the commentary fit the character. If "Ferocious Feline" attacks, say something about scratching/pouncing/claws. If "Ink Blob" hits, maybe splat/ooze/smear. Get creative!
- Be unhinged, funny, dramatic. Use slang, hyperbole. Gen-Z energy.
- Examples: "OUCH! Ferocious Feline just landed a huge scratch!", "That Ink Demon really went splat on them", "RIP Scribble Dragon, you will be missed", "Bro the pounce was INSANE".
Make it flavorful and character-relevant.`,
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
