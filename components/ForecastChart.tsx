"use client";
import React from "react";

interface ForecastChartProps {
  data: number[];
}

export default function ForecastChart({ data }: ForecastChartProps) {
  if (!data || data.length === 0) return (
    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
      No predictive data available
    </div>
  );

  const maxVal = Math.max(...data, 10);
  const minVal = Math.min(...data);
  const padding = 20;
  const height = 120;
  const width = 300;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = height - ((val - minVal) / (maxVal - minVal || 1)) * (height - 2 * padding) - padding;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `${padding},${height} ${points} ${width - padding},${height}`;

  return (
    <div className="relative h-full w-full group">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0.05" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
             <feGaussianBlur stdDeviation="2" result="blur" />
             <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Fill Area */}
        <polyline
          points={areaPoints}
          fill="url(#chartGradient)"
          className="transition-all duration-1000 ease-in-out"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          className="transition-all duration-1000 ease-in-out opacity-80"
        />

        {/* Data Points */}
        {data.map((val, i) => {
           const [x, y] = points.split(" ")[i].split(",");
           return (
             <circle 
               key={i} 
               cx={x} cy={y} r="4" 
               fill="white" stroke="black" strokeWidth="2"
               className="hover:r-6 transition-all cursor-crosshair"
             />
           );
        })}
      </svg>
      
      {/* Time Markers */}
      <div className="absolute bottom-[-5px] left-0 right-0 flex justify-between px-4 text-[7px] font-black text-zinc-400 uppercase tracking-tighter">
        <span>Now</span>
        <span>+1h</span>
        <span>+2h</span>
        <span>+3h</span>
      </div>
    </div>
  );
}
