"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { GestureMove } from "@shared/types";

interface BattleGestureControlsProps {
  gestureMoves: GestureMove[];
  onGestureAttack: (moveId: string, drawingData?: string) => void;
  attackCooldownRemaining?: number;
  attackDisabled?: boolean;
}

export default function BattleGestureControls({
  gestureMoves,
  onGestureAttack,
  attackCooldownRemaining = 0,
  attackDisabled = false,
}: BattleGestureControlsProps) {
  const isOnCooldown = attackCooldownRemaining > 0 || attackDisabled;
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentDrawStroke, setCurrentDrawStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [drawSentFeedback, setDrawSentFeedback] = useState(false);

  const getMoveByGesture = useCallback(
    (gesture: "tap" | "swipe" | "draw") => {
      return gestureMoves.find((m) => m.gesture === gesture);
    },
    [gestureMoves]
  );

  // Draw canvas for "draw" gesture
  const getDrawPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!getMoveByGesture("draw") || isOnCooldown) return;
      e.preventDefault();
      const point = getDrawPoint(e);
      setCurrentDrawStroke([point]);
    },
    [getMoveByGesture, getDrawPoint, isOnCooldown]
  );

  const moveDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!currentDrawStroke) return;
      e.preventDefault();
      const point = getDrawPoint(e);
      setCurrentDrawStroke((prev) => (prev ? [...prev, point] : [point]));
    },
    [currentDrawStroke, getDrawPoint]
  );

  const endDraw = useCallback(() => {
    if ((currentDrawStroke && currentDrawStroke.length >= 2) && !isOnCooldown) {
      const move = getMoveByGesture("draw");
      if (move) {
        const canvas = drawCanvasRef.current;
        const rect = canvas?.getBoundingClientRect();
        const srcW = rect?.width || 400;
        const srcH = rect?.height || 80;
        const scaleToCanvasX = 400 / srcW;
        const scaleToCanvasY = 80 / srcH;
        const points = currentDrawStroke.map((p) => ({
          x: p.x * scaleToCanvasX,
          y: p.y * scaleToCanvasY,
        }));
        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;
        for (let i = 1; i < points.length; i++) {
          minX = Math.min(minX, points[i].x);
          minY = Math.min(minY, points[i].y);
          maxX = Math.max(maxX, points[i].x);
          maxY = Math.max(maxY, points[i].y);
        }
        const pad = 8;
        const boxW = maxX - minX || 1;
        const boxH = maxY - minY || 1;
        const size = 80;
        const fit = size - pad * 2;
        const scale = Math.min(fit / boxW, fit / boxH, 3);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const offX = size / 2 - centerX * scale;
        const offY = size / 2 - centerY * scale;

        const offscreen = document.createElement("canvas");
        offscreen.width = size;
        offscreen.height = size;
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, size, size);
          ctx.strokeStyle = "#1a1a1a";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(points[0].x * scale + offX, points[0].y * scale + offY);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x * scale + offX, points[i].y * scale + offY);
          }
          ctx.stroke();
        }
        const drawingData = offscreen.toDataURL("image/png");
        onGestureAttack(move.id, drawingData);
        setDrawSentFeedback(true);
        setTimeout(() => setDrawSentFeedback(false), 1200);
      }
    }
    setCurrentDrawStroke(null);
    requestAnimationFrame(() => {
      const canvas = drawCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    });
  }, [currentDrawStroke, getMoveByGesture, onGestureAttack, isOnCooldown]);

  // Draw current stroke on canvas for feedback (opaque background so export is visible)
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !currentDrawStroke?.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scaleX = canvas.width / canvas.getBoundingClientRect().width;
    const scaleY = canvas.height / canvas.getBoundingClientRect().height;
    ctx.fillStyle = "#fefef6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(currentDrawStroke[0].x * scaleX, currentDrawStroke[0].y * scaleY);
    for (let i = 1; i < currentDrawStroke.length; i++) {
      ctx.lineTo(currentDrawStroke[i].x * scaleX, currentDrawStroke[i].y * scaleY);
    }
    ctx.stroke();
  }, [currentDrawStroke]);

  const drawMove = getMoveByGesture("draw");

  return (
    <div className="w-full max-w-[800px] flex flex-col gap-2">
        <div className="flex flex-wrap justify-center gap-3">
          {gestureMoves.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-gray-600 bg-white/90 font-hand text-sm"
            >
              <span className="font-bold text-gray-500 capitalize">{m.gesture}:</span>
              <span className="text-gray-800">{m.action}</span>
              <span className="text-red-600 font-bold">{m.power} dmg</span>
            </div>
          ))}
        </div>
        {drawMove && (
          <div className={`flex flex-col gap-1 ${isOnCooldown ? "opacity-60 pointer-events-none" : ""}`}>
            <p className="font-hand text-xs text-gray-500 text-center">
              {isOnCooldown
                ? attackDisabled
                  ? "Get ready..."
                  : `Attack in ${attackCooldownRemaining.toFixed(1)}s`
                : `Draw here to use "${drawMove.action}"`}
            </p>
            {drawSentFeedback && (
              <p className="font-hand text-sm font-bold text-green-600 text-center animate-pulse">
                Draw attack sent!
              </p>
            )}
            <div className="relative w-full h-20 border-2 border-dashed border-gray-400 rounded-lg overflow-hidden bg-[#fefef6]">
              <canvas
                ref={drawCanvasRef}
                className="absolute inset-0 w-full h-full touch-none"
                width={400}
                height={80}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
            </div>
          </div>
        )}
    </div>
  );
}
