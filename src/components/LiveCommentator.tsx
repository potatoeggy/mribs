"use client";

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";

export interface LiveCommentatorHandle {
  speak: (text: string) => void;
}

export interface LiveCommentatorProps {
  /** Optional avatar ID from LiveAvatar */
  avatarId?: string;
  /** Optional voice ID for accent/style (e.g. Toronto mans) */
  voiceId?: string;
  /** Called when commentator is ready to speak */
  onReady?: () => void;
  /** Called when commentator has an error */
  onError?: (err: Error) => void;
  className?: string;
}

const LiveCommentator = forwardRef<LiveCommentatorHandle, LiveCommentatorProps>(
  function LiveCommentator({ avatarId, voiceId, onReady, onError, className = "" }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sessionRef = useRef<LiveAvatarSession | null>(null);
    const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");

    const speak = useCallback((text: string) => {
      const session = sessionRef.current;
      if (!session || status !== "ready") return;
      try {
        session.message(text);
      } catch (err) {
        console.warn("Commentator speak error:", err);
      }
    }, [status]);

    useImperativeHandle(ref, () => ({ speak }), [speak]);

    useEffect(() => {
      let mounted = true;
      let session: LiveAvatarSession | null = null;

      const connect = async () => {
        setStatus("connecting");
        setErrorMessage("");
        try {
          const body: Record<string, string> = {};
          if (avatarId) body.avatar_id = avatarId;
          if (voiceId) body.voice_id = voiceId;

          const res = await fetch("/api/liveavatar/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data?.error ?? "Failed to get LiveAvatar token");
          }

          const token = data.session_token;
          if (!token) throw new Error("No session token returned");

          session = new LiveAvatarSession(token, {
            voiceChat: false,
          });
          sessionRef.current = session;

          session.on(SessionEvent.SESSION_STREAM_READY, () => {
            if (!mounted) return;
            if (videoRef.current) {
              session!.attach(videoRef.current);
            }
            setStatus("ready");
            onReady?.();
          });

          session.on(SessionEvent.SESSION_DISCONNECTED, () => {
            if (mounted) setStatus("idle");
          });

          await session.start();
          if (!mounted) {
            await session.stop();
          }
        } catch (err) {
          if (!mounted) return;
          const e = err instanceof Error ? err : new Error(String(err));
          setStatus("error");
          setErrorMessage(e.message);
          onError?.(e);
        }
      };

      connect();

      return () => {
        mounted = false;
        if (session) {
          session.stop().catch(() => {});
          sessionRef.current = null;
        }
        setStatus("idle");
      };
    }, [avatarId, voiceId, onReady, onError]);

    return (
      <div
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-gray-300 bg-white/95 p-3 shadow-lg ${className}`}
      >
        <div className="relative aspect-video w-full max-w-[280px] overflow-hidden rounded-lg bg-gray-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
          {status === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="ml-2 text-sm text-white">Connecting commentator...</span>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 p-4 text-center text-sm text-white">
              <p>Commentator unavailable</p>
              <p className="mt-1 text-xs text-red-300">{errorMessage}</p>
            </div>
          )}
        </div>
        <p className="font-hand text-sm font-bold text-gray-600">
          {status === "ready" ? "🗣️ Live commentator" : status === "connecting" ? "..." : "Commentator offline"}
        </p>
      </div>
    );
  }
);

export default LiveCommentator;
