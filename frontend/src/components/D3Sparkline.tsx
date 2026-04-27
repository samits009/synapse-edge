"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface SparklineProps {
  color?: string;
  width?: number;
  height?: number;
}

export default function D3Sparkline({ color = "#10b981", width = 200, height = 48 }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    // Clear existing for strict-mode safety
    d3.select(svgElement).selectAll("*").remove();

    const n = 24; // Number of points
    const data = d3.range(n).map(() => Math.random() * 100);

    const margin = { top: 5, right: -5, bottom: -5, left: -5 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([0, n - 1]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    const line = d3.line<number>()
      .x((d, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    const area = d3.area<number>()
      .x((d, i) => x(i))
      .y0(innerHeight)
      .y1((d) => y(d))
      .curve(d3.curveMonotoneX);

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Dynamic Gradient
    const defs = svg.append("defs");
    const gradientId = `spark-gradient-${Math.random().toString(36).substring(2, 9)}`;
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.4);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.0);

    const pathArea = svg.append("path")
      .datum(data)
      .attr("fill", `url(#${gradientId})`)
      .attr("d", area);

    const pathLine = svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", line);

    let tickTimer: NodeJS.Timeout;

    const tick = () => {
      // Add new random data point
      const lastVal = data[data.length - 1];
      const variance = (Math.random() - 0.5) * 40;
      data.push(Math.max(10, Math.min(90, lastVal + variance))); // Keep within bounds

      // Slide the line and area paths to the left
      pathLine.attr("d", line)
        .attr("transform", null)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attr("transform", `translate(${x(-1)},0)`);

      pathArea.attr("d", area)
        .attr("transform", null)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attr("transform", `translate(${x(-1)},0)`)
        .on("end", () => {
          // Remove the oldest point once transition finishes
          data.shift();
        });

      tickTimer = setTimeout(tick, 2000);
    };

    tick();

    return () => {
      clearTimeout(tickTimer);
      d3.select(svgElement).selectAll("*").remove();
    };
  }, [color, width, height]);

  return (
    <svg 
      ref={svgRef} 
      className="block w-full h-full" 
      viewBox={`0 0 ${width} ${height}`} 
      preserveAspectRatio="none" 
    />
  );
}
