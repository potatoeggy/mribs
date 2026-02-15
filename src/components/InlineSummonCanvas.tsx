"use client";

import React, { useRef, useState, useEffect } from "react";

interface InlineSummonCanvasProps {
  onSubmit: (imageData: string) => void;
  inkCost: number;
  currentInk: number;
  teamColor: string;
  disabled?: boolean;
}

export default function InlineSummonCanvas({
  onSubmit,
  inkCost,
  currentInk,
  teamColor,
  disabled = false,
}: InlineSummonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#FEFEF6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  const startDrawing = (e: React.PointerEvent) => {
    if (disabled || currentInk < inkCost) return;
    setIsDrawing(true);
    setHasDrawn(true);
    draw(e);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing && e.type !== "pointerdown") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = teamColor;

    if (e.type === "pointerdown") {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FEFEF6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const imageData = canvas.toDataURL("image/png");
    onSubmit(imageData);
    handleClear();
  };

  const canAfford = currentInk >= inkCost;

  return (
    <div className="flex gap-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        className="border-2 border-gray-800 rounded cursor-crosshair touch-none flex-shrink-0"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        style={{ backgroundColor: "#FEFEF6" }}
      />
      <div className="flex flex-col gap-2 justify-center">
        <button
          onClick={handleClear}
          disabled={!hasDrawn}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-800 font-hand font-bold rounded border-2 border-gray-800 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hasDrawn || !canAfford || disabled}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-hand font-bold rounded border-2 border-gray-800 transition-colors"
        >
          {!canAfford ? `Need ${inkCost}` : "Summon!"}
        </button>
        {!canAfford && (
          <p className="text-xs text-red-600 font-hand">
            Not enough ink
          </p>
        )}
      </div>
    </div>
  );
}
