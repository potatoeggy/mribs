"use client";

import React from "react";

/**
 * Floating doodle shapes - fun background decoration on every page.
 * Evenly spread across the viewport including center.
 */
export default function FloatingDoodles() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
      aria-hidden
    >
      {/* Top row: 10%, 30%, 50%, 70%, 90% */}
      <svg className="absolute top-[8%] left-[8%] w-[140px] h-[140px] text-gray-300/35 animate-float" viewBox="0 0 40 40" fill="none">
        <path d="M5,20 Q15,5 30,20 Q20,35 5,20" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="absolute top-[12%] left-[28%] w-[120px] h-[120px] text-amber-300/28 animate-float" style={{ animationDelay: "0.5s" }} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="absolute top-[5%] left-[48%] w-[180px] h-[80px] text-blue-300/25 animate-float" style={{ animationDelay: "1s" }} viewBox="0 0 200 20" fill="none">
        <path d="M0,10 Q25,2 50,10 Q75,18 100,10 Q125,2 150,10 Q175,18 200,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <svg className="absolute top-[10%] right-[28%] w-[130px] h-[130px] text-gray-400/30 animate-float" style={{ animationDelay: "0.7s" }} viewBox="0 0 40 40" fill="none">
        <path d="M20,5 L25,15 L35,20 L25,25 L20,35 L15,25 L5,20 L15,15 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute top-[6%] right-[5%] w-[150px] h-[150px] text-amber-200/28 animate-float" style={{ animationDelay: "1.2s" }} viewBox="0 0 40 40" fill="none">
        <path d="M10,10 Q25,5 35,20 Q30,35 15,30 Q5,25 10,10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>

      {/* Middle row: 15%, 35%, 50%, 65%, 85% */}
      <svg className="absolute top-[35%] left-[12%] w-[160px] h-[160px] text-blue-300/25 animate-float" style={{ animationDelay: "0.3s" }} viewBox="0 0 40 40" fill="none">
        <path d="M20,5 Q35,15 30,30 Q15,35 5,20 Q10,10 20,5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="absolute top-[38%] left-[32%] w-[100px] h-[100px] text-gray-300/32 animate-float" style={{ animationDelay: "1.4s" }} viewBox="0 0 40 40" fill="none">
        <path d="M20,8 L28,20 L20,32 L12,20 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
      <svg className="absolute top-[42%] left-[48%] w-[140px] h-[140px] text-amber-300/25 animate-float" style={{ animationDelay: "0.6s" }} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" fill="none" />
      </svg>
      <svg className="absolute top-[36%] right-[32%] w-[120px] h-[120px] text-gray-400/30 animate-float" style={{ animationDelay: "1.8s" }} viewBox="0 0 40 40" fill="none">
        <path d="M10,30 L20,10 L30,30 L20,25 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute top-[40%] right-[10%] w-[150px] h-[150px] text-blue-200/28 animate-float" style={{ animationDelay: "0.9s" }} viewBox="0 0 40 40" fill="none">
        <path d="M8,25 Q20,8 32,25 Q20,38 8,25" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>

      {/* Bottom row: 10%, 30%, 50%, 70%, 90% */}
      <svg className="absolute bottom-[10%] left-[8%] w-[200px] h-[80px] text-gray-400/28 animate-float" style={{ animationDelay: "1.6s" }} viewBox="0 0 200 20" fill="none">
        <path d="M0,10 Q50,0 100,10 Q150,20 200,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <svg className="absolute bottom-[12%] left-[30%] w-[130px] h-[130px] text-amber-200/28 animate-float" style={{ animationDelay: "2s" }} viewBox="0 0 40 40" fill="none">
        <path d="M20,8 L32,32 L8,32 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute bottom-[8%] left-[48%] w-[160px] h-[160px] text-gray-300/30 animate-float" style={{ animationDelay: "1.2s" }} viewBox="0 0 40 40" fill="none">
        <path d="M5,20 Q15,5 30,20 Q20,35 5,20" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="absolute bottom-[15%] right-[30%] w-[110px] h-[110px] text-blue-300/25 animate-float" style={{ animationDelay: "2.2s" }} viewBox="0 0 40 40" fill="none">
        <path d="M5,20 L20,5 L35,20 L20,35 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute bottom-[10%] right-[6%] w-[180px] h-[80px] text-amber-300/25 animate-float" style={{ animationDelay: "1.1s" }} viewBox="0 0 200 20" fill="none">
        <path d="M0,10 Q50,2 100,10 T200,10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>

      {/* Extra: left & right mid-edges */}
      <svg className="absolute top-[65%] left-[3%] w-[100px] h-[100px] text-gray-300/30 animate-float" style={{ animationDelay: "2.4s" }} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute top-[68%] right-[5%] w-[120px] h-[120px] text-amber-300/25 animate-float" style={{ animationDelay: "1.5s" }} viewBox="0 0 40 40" fill="none">
        <path d="M20,5 L25,15 L35,20 L25,25 L20,35 L15,25 L5,20 L15,15 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}
