"use client";

import React, { useRef, useEffect, useCallback } from "react";
import type { Stroke } from "@/lib/ink";

const ERASER_WIDTH = 20;

interface OpponentCanvasProps {
  strokes: Stroke[];
}

export default function OpponentCanvas({ strokes }: OpponentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fefef6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e8e8e0";
    ctx.lineWidth = 0.5;
    for (let y = 30; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? "#fefef6" : stroke.color;
      ctx.lineWidth = stroke.isEraser ? ERASER_WIDTH : stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    if (strokes.length === 0) {
      ctx.fillStyle = "#b0b0b0";
      ctx.font = "20px var(--font-hand, sans-serif)";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for opponent to draw...", canvas.width / 2, canvas.height / 2);
    }
  }, [strokes]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [redrawCanvas]);

  return (
    <div className="flex flex-col h-full w-full gap-2">
      <div className="flex items-center justify-between px-2 h-9">
        <span className="font-hand text-sm text-gray-400">
          {strokes.length > 0 ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}` : "waiting..."}
        </span>
      </div>

      <div className="flex-1 relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-[#fefef6]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="h-[36px]" />
    </div>
  );
}
