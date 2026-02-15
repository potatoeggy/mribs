"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Stroke, totalInkUsed, inkRemainingFraction } from "@/lib/ink";
import InkMeter from "./InkMeter";

const LINE_WIDTHS = [2, 4, 6, 10];
const ERASER_WIDTH = 20;

interface DrawingCanvasProps {
  inkBudget: number;
  onSubmit: (imageData: string, inkSpent: number) => void;
  timeRemaining: number;
  disabled?: boolean;
  onStrokeComplete?: (stroke: Stroke) => void;
  onStrokeUndo?: () => void;
  onStrokeClear?: () => void;
  teamColor: string; // Player's team color (red or blue)
}

export default function DrawingCanvas({
  inkBudget,
  onSubmit,
  timeRemaining,
  disabled = false,
  onStrokeComplete,
  onStrokeUndo,
  onStrokeClear,
  teamColor,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedWidth, setSelectedWidth] = useState(LINE_WIDTHS[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);

  const inkUsed = totalInkUsed(strokes);
  const inkRemaining = inkBudget - inkUsed;
  const inkRemainingFrac = Math.max(0, inkRemaining / inkBudget);

  // Redraw canvas whenever strokes change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear with white background
    ctx.fillStyle = "#fefef6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (notebook paper effect)
    ctx.strokeStyle = "#e8e8e0";
    ctx.lineWidth = 0.5;
    for (let y = 30; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all completed strokes
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? "#fefef6" : stroke.color;
      ctx.lineWidth = stroke.isEraser ? ERASER_WIDTH : stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Use quadratic curves for smooth lines
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
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize canvas to fill container
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

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    if (inkUsed >= inkBudget && !isEraser) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    const newStroke: Stroke = {
      points: [point],
      color: teamColor, // Use team color instead of selected color
      lineWidth: selectedWidth,
      isEraser,
    };
    setCurrentStroke(newStroke);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke || disabled) return;
    e.preventDefault();
    const point = getCanvasPoint(e);

    // Check ink budget for non-eraser strokes
    if (!isEraser) {
      const tentativeStroke = {
        ...currentStroke,
        points: [...currentStroke.points, point],
      };
      const tentativeTotal = totalInkUsed([...strokes, tentativeStroke]);
      if (tentativeTotal > inkBudget) {
        stopDrawing();
        return;
      }
    }

    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, point],
    });
  };

  const stopDrawing = () => {
    if (currentStroke && currentStroke.points.length >= 2) {
      setUndoStack((prev) => [...prev, strokes]);
      setStrokes((prev) => [...prev, currentStroke]);
      onStrokeComplete?.(currentStroke);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousStrokes = undoStack[undoStack.length - 1];
    setStrokes(previousStrokes);
    setUndoStack((prev) => prev.slice(0, -1));
    onStrokeUndo?.();
  };

  const handleClear = () => {
    setUndoStack((prev) => [...prev, strokes]);
    setStrokes([]);
    onStrokeClear?.();
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL("image/png");
    onSubmit(imageData, inkUsed);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full w-full gap-2">
      <div className="flex items-center justify-between px-2 h-9">
        <InkMeter fraction={inkRemainingFrac} label={`${inkRemaining.toFixed(0)} / ${inkBudget} ink`} />
        <button
          onClick={handleSubmit}
          disabled={disabled || strokes.length === 0}
          className="sketchy-button bg-green-400 text-black px-5 py-1.5 font-hand text-base disabled:opacity-40"
        >
          Done!
        </button>
      </div>

      <div className="flex-1 relative border-2 border-dashed border-gray-400 rounded-lg overflow-hidden bg-[#fefef6]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex items-center justify-center gap-2 px-2 py-1 flex-wrap">
        {/* Team color indicator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg border border-gray-300">
          <div
            className="w-6 h-6 rounded-full border-2 border-gray-800"
            style={{ backgroundColor: teamColor }}
          />
          <span className="font-hand text-sm text-gray-700">Your team</span>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex gap-1 items-center">
          {LINE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => {
                setSelectedWidth(w);
                setIsEraser(false);
              }}
              className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-transform ${
                selectedWidth === w && !isEraser
                  ? "border-gray-800 bg-gray-100 scale-110"
                  : "border-gray-300"
              }`}
            >
              <div
                className="rounded-full bg-gray-800"
                style={{ width: w + 2, height: w + 2 }}
              />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`px-2 py-1 rounded-lg border font-hand text-sm transition-transform ${
            isEraser
              ? "border-gray-800 bg-pink-100 scale-110"
              : "border-gray-300 bg-white"
          }`}
        >
          Eraser
        </button>

        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="px-2 py-1 rounded-lg border border-gray-300 bg-white font-hand text-sm disabled:opacity-30"
        >
          Undo
        </button>

        <button
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="px-2 py-1 rounded-lg border border-gray-300 bg-white font-hand text-sm disabled:opacity-30"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
