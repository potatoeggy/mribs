import { NextRequest, NextResponse } from "next/server";

const LIVEAVATAR_API = "https://api.liveavatar.com";

/** Sandbox mode only supports this preset avatar (Wayne). No credits consumed in sandbox. */
const SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

function getApiKey(): string | null {
  return process.env.LIVEAVATAR_API_KEY ?? process.env.HEYGEN_API_KEY ?? null;
}

/**
 * Fetch first available public avatar ID (fallback when none provided)
 */
async function getDefaultAvatarId(apiKey: string): Promise<string | null> {
  const res = await fetch(`${LIVEAVATAR_API}/v1/avatars/public?page_size=5`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const results = json?.data?.results ?? json?.results ?? [];
  const active = results.find((a: { status?: string }) => a.status === "ACTIVE");
  return active?.id ?? results[0]?.id ?? null;
}

/**
 * Fetch first available voice ID (optional, for accent/style)
 */
async function getDefaultVoiceId(apiKey: string): Promise<string | null> {
  const res = await fetch(`${LIVEAVATAR_API}/v1/voices?page_size=20`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const results = json?.data?.results ?? json?.results ?? [];
  // Prefer English voices; look for Canadian/interesting accents by name
  const voice = results.find(
    (v: { language?: string; name?: string }) =>
      (v.language === "en" || v.language?.startsWith("en")) &&
      (v.name?.toLowerCase().includes("canadian") ||
        v.name?.toLowerCase().includes("toronto") ||
        v.name?.toLowerCase().includes("male"))
  ) ?? results.find((v: { language?: string }) => v.language === "en" || v.language?.startsWith("en")) ?? results[0];
  return voice?.id ?? null;
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing LIVEAVATAR_API_KEY or HEYGEN_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    let { avatar_id: avatarId, voice_id: voiceId } = body as {
      avatar_id?: string;
      voice_id?: string;
    };

    if (!avatarId) {
      avatarId = (await getDefaultAvatarId(apiKey)) ?? undefined;
    }
    if (!voiceId) {
      voiceId = (await getDefaultVoiceId(apiKey)) ?? undefined;
    }

    if (!avatarId) {
      return NextResponse.json(
        { error: "No avatar available. Add an avatar in LiveAvatar dashboard or provide avatar_id." },
        { status: 400 }
      );
    }

    const isSandbox = process.env.NODE_ENV === "development";
    const payload: Record<string, unknown> = {
      mode: "FULL",
      avatar_id: isSandbox ? SANDBOX_AVATAR_ID : (avatarId ?? undefined),
      is_sandbox: isSandbox,
      avatar_persona: {
        voice_id: voiceId || null,
        context_id: null,
        language: "en",
      },
      interactivity_type: "CONVERSATIONAL",
    };

    const res = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("LiveAvatar token error:", res.status, data);
      return NextResponse.json(
        { error: data?.message ?? data?.detail ?? "Failed to create LiveAvatar session" },
        { status: res.status >= 400 ? res.status : 500 }
      );
    }

    const sessionId = data?.data?.session_id ?? data?.session_id;
    const sessionToken = data?.data?.session_token ?? data?.session_token;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "No session token in LiveAvatar response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session_id: sessionId,
      session_token: sessionToken,
    });
  } catch (err) {
    console.error("LiveAvatar token route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
