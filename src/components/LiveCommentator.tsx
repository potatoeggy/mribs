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
    const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "error" | "reconnecting">("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");

    const isReadyRef = useRef(false);
    const pendingLineRef = useRef<string | null>(null);
    const isSpeakingRef = useRef(false);

    const doSpeak = useCallback((text: string) => {
      const session = sessionRef.current;
      if (!session || !isReadyRef.current) {
        // Replace pending line with latest (don't queue)
        pendingLineRef.current = text;
        return;
      }

      if (isSpeakingRef.current) {
        // Replace pending line with latest (don't queue)
        pendingLineRef.current = text;
        return;
      }

      pendingLineRef.current = null;
      isSpeakingRef.current = true;

      try {
        session.message(text);
        // Estimate speech duration: ~150 words per minute, ~5 chars per word
        const words = text.length / 5;
        const durationMs = (words / 150) * 60 * 1000;
        // Add extra buffer time
        const totalDuration = Math.max(2000, durationMs + 500);

        setTimeout(() => {
          isSpeakingRef.current = false;
          // If there's a pending line, speak it now
          const next = pendingLineRef.current;
          if (next) {
            pendingLineRef.current = null;
            doSpeak(next);
          }
        }, totalDuration);
      } catch (err) {
        console.warn("Commentator speak error:", err);
        isSpeakingRef.current = false;
      }
    }, []);

    const speak = useCallback((text: string) => {
      doSpeak(text);
    }, [doSpeak]);

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
            isReadyRef.current = true;
            setStatus("ready");
            onReady?.();
            const pending = pendingLineRef.current;
            if (pending) {
              pendingLineRef.current = null;
              try {
                session!.message(pending);
              } catch (err) {
                console.warn("Commentator speak pending error:", err);
              }
            }
          });

          session.on(SessionEvent.SESSION_DISCONNECTED, () => {
            if (!mounted) return;
            isReadyRef.current = false;
            sessionRef.current = null;
            setStatus("reconnecting");
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
        isReadyRef.current = false;
        setStatus("idle");
      };
    }, [avatarId, voiceId, onReady, onError]);

    // Auto-reconnect when session ends (e.g. sandbox 1-min limit) or when tab becomes visible
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      if (status !== "reconnecting") return;

      const tryReconnect = async () => {
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
          if (!res.ok) throw new Error(data?.error ?? "Reconnect failed");
          const token = data.session_token;
          if (!token) throw new Error("No token");
          const s = new LiveAvatarSession(token, { voiceChat: false });
          sessionRef.current = s;
          s.on(SessionEvent.SESSION_STREAM_READY, () => {
            if (videoRef.current) s.attach(videoRef.current);
            isReadyRef.current = true;
            setStatus("ready");
            const pending = pendingLineRef.current;
            if (pending) {
              pendingLineRef.current = null;
              try {
                s.message(pending);
              } catch {
                /* ignore */
              }
            }
          });
          s.on(SessionEvent.SESSION_DISCONNECTED, () => {
            isReadyRef.current = false;
            sessionRef.current = null;
            setStatus("reconnecting");
          });
          await s.start();
        } catch (err) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Reconnect failed");
        }
      };

      reconnectTimeoutRef.current = setTimeout(tryReconnect, 2000);

      const onVisible = () => {
        if (document.visibilityState === "visible" && status === "reconnecting") {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          tryReconnect();
        }
      };
      document.addEventListener("visibilitychange", onVisible);

      return () => {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, [status, avatarId, voiceId]);

    return (
      <div
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-gray-300 bg-white/95 p-3 shadow-lg ${className}`}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
          {(status === "connecting" || status === "reconnecting") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="mt-2 text-sm text-white">
                {status === "reconnecting" ? "Session ended, reconnecting..." : "Connecting commentator..."}
              </span>
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
          {status === "ready"
            ? "🗣️ Live commentator"
            : status === "connecting" || status === "reconnecting"
              ? "Reconnecting..."
              : "Commentator offline"}
        </p>
      </div>
    );
  }
);

export default LiveCommentator;
