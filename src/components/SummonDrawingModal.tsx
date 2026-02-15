"use client";

import React, { useRef, useEffect, useState } from "react";
import { Stroke, totalInkUsed } from "@/lib/ink";

interface SummonDrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (imageData: string, inkSpent: number) => void | Promise<void>;
  inkCost: number;
  currentInk: number;
  inline?: boolean;
  teamColor?: string;
}

export default function SummonDrawingModal({
  isOpen,
  onClose,
  onSubmit,
  inkCost: _inkCost,
  currentInk,
  inline = false,
  teamColor = "#1a1a1a",
}: SummonDrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const inkUsed = totalInkUsed(strokes);
  const inkRemaining = currentInk - inkUsed;
  const canAfford = inkRemaining >= 0;

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#FEFEF6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
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
  }, [strokes, currentStroke]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    // Clear when opening
    setStrokes([]);
    setCurrentStroke(null);
    setHasDrawn(false);
  }, [isOpen]);

  const getCanvasPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    if (inkRemaining <= 0 || isSubmitting) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    const newStroke: Stroke = {
      points: [point],
      color: teamColor,
      lineWidth: 3,
      isEraser: false,
    };
    setCurrentStroke(newStroke);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const point = getCanvasPoint(e);

    // Check if we have enough ink for this point
    const tentativeStroke = {
      ...currentStroke,
      points: [...currentStroke.points, point],
    };
    const tentativeTotal = totalInkUsed([...strokes, tentativeStroke]);
    if (tentativeTotal > currentInk) {
      stopDrawing();
      return;
    }

    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, point],
    });
  };

  const stopDrawing = () => {
    if (currentStroke && currentStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke(null);
    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || !canAfford || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const imageData = canvas.toDataURL("image/png");
      await onSubmit(imageData, inkUsed);
      handleClear();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !inline) return null;

  const content = (
    <>
      {!inline && (
        <>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors text-2xl font-bold text-gray-600 hover:text-gray-800"
          >
            ×
          </button>

          <h2 className="font-hand text-3xl font-bold text-gray-800 mb-2">
            Summon a Fighter
          </h2>
          <p className="text-gray-600 mb-4">
            Draw a new creature to join the battle! Stronger = more ink
          </p>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-800">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (inkUsed / currentInk) * 100)}%`,
                    backgroundColor: teamColor,
                  }}
                />
              </div>
            </div>
            <span className="font-hand text-lg font-bold text-gray-800 min-w-[120px]">
              {inkUsed.toFixed(0)} / {currentInk.toFixed(0)} ink
            </span>
          </div>
        </>
      )}

      {!canAfford && hasDrawn && (
        <div className="bg-red-100 border-2 border-red-400 rounded-lg p-3 mb-4">
          <p className="text-red-700 font-hand font-bold">
            Not enough ink remaining!
          </p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={600}
        height={300}
        className={`w-full border-4 border-gray-800 rounded-lg touch-none mb-4 ${isSubmitting ? "cursor-wait pointer-events-none opacity-90" : "cursor-crosshair"}`}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        style={{ backgroundColor: "#FEFEF6" }}
      />

      <div className="flex gap-3">
        <button
          onClick={handleClear}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-hand font-bold text-base rounded-lg transition-colors border-2 border-gray-800"
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hasDrawn || !canAfford || inkUsed < 20 || isSubmitting}
          className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-hand font-bold text-base rounded-lg transition-colors border-2 border-gray-800 disabled:border-gray-400"
        >
          {!canAfford ? "Not Enough Ink" : inkUsed < 20 ? "Draw More" : `Summon! (${inkUsed.toFixed(0)} ink) ✨`}
        </button>
      </div>
    </>
  );

  if (inline) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 relative">
        {content}
      </div>
    </div>
  );
}
