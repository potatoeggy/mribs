"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Stroke, totalInkUsed, inkRemainingFraction } from "@/lib/ink";
import InkMeter from "./InkMeter";

const COLORS = ["#1a1a1a", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"];
const LINE_WIDTHS = [2, 4, 6, 10];
const ERASER_WIDTH = 20;

interface DrawingCanvasProps {
  inkBudget: number;
  onSubmit: (imageData: string) => void;
  timeRemaining: number;
  disabled?: boolean;
}

export default function DrawingCanvas({
  inkBudget,
  onSubmit,
  timeRemaining,
  disabled = false,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedWidth, setSelectedWidth] = useState(LINE_WIDTHS[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);

  const inkRemaining = inkRemainingFraction(strokes, inkBudget);
  const inkUsed = totalInkUsed(strokes);

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
      color: selectedColor,
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
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousStrokes = undoStack[undoStack.length - 1];
    setStrokes(previousStrokes);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setUndoStack((prev) => [...prev, strokes]);
    setStrokes([]);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL("image/png");
    onSubmit(imageData);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full w-full gap-3">
      {/* Top bar: timer + ink meter */}
      <div className="flex items-center justify-between px-4">
        <div className="font-hand text-2xl font-bold">
          {formatTime(timeRemaining)}
        </div>
        <InkMeter fraction={inkRemaining} />
        <button
          onClick={handleSubmit}
          disabled={disabled || strokes.length === 0}
          className="sketchy-button bg-green-400 text-black px-6 py-2 font-hand text-lg disabled:opacity-40"
        >
          Done!
        </button>
      </div>

      {/* Canvas */}
      <div className="flex flex-grow flex-1 relative border-2 border-dashed border-gray-400 rounded-lg overflow-hidden bg-[#fefef6]">
        <canvas
          ref={canvasRef}
          className="h-[400px]"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}

        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-center gap-3 px-4 py-2 flex-wrap">
        {/* Colors */}
        <div className="flex gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => {
                setSelectedColor(color);
                setIsEraser(false);
              }}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                selectedColor === color && !isEraser
                  ? "border-gray-800 scale-125 ring-2 ring-gray-400"
                  : "border-gray-300"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Line widths */}
        <div className="flex gap-1.5 items-center">
          {LINE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => {
                setSelectedWidth(w);
                setIsEraser(false);
              }}
              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-transform ${
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

        {/* Separator */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Eraser */}
        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`px-3 py-1.5 rounded-lg border font-hand text-sm transition-transform ${
            isEraser
              ? "border-gray-800 bg-pink-100 scale-110"
              : "border-gray-300 bg-white"
          }`}
        >
          Eraser
        </button>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-hand text-sm disabled:opacity-30"
        >
          Undo
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-hand text-sm disabled:opacity-30"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
