import { NextRequest, NextResponse } from "next/server";

const LIVEAVATAR_API = "https://api.liveavatar.com";

function getApiKey(): string | null {
  return process.env.LIVEAVATAR_API_KEY ?? process.env.HEYGEN_API_KEY ?? null;
}

export async function GET(_request: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing LIVEAVATAR_API_KEY or HEYGEN_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${LIVEAVATAR_API}/v1/voices?page_size=50`, {
      headers: { "X-API-KEY": apiKey },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message ?? "Failed to fetch voices" },
        { status: res.status }
      );
    }

    const results = data?.data?.results ?? data?.results ?? [];
    return NextResponse.json(results);
  } catch (err) {
    console.error("LiveAvatar voices error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
