import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { formatNumberFull } from '@/utils/colorScales';
import type { SauRegionYear } from '@/types/data';

interface SauChartProps {
  regionData: SauRegionYear;
}

export const SauChart = ({ regionData }: SauChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render chart
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 30, bottom: 40, left: 80 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const rawEntries = Object.entries(regionData.sau_by_year)
      .map(([year, sau]) => ({ year: +year, sau }))
      .sort((a, b) => a.year - b.year);

    const base2016 = rawEntries.find(d => d.year === 2016)?.sau;
    if (!base2016 || base2016 === 0) return;

    const entries = rawEntries.map(d => ({
      year: d.year,
      sau: d.sau,
      pct: (d.sau / base2016) * 100,
    }));

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
      .domain(d3.extent(entries, d => d.year) as [number, number])
      .range([0, width]);

    const yMin = d3.min(entries, d => d.pct)!;
    const y = d3.scaleLinear()
      .domain([Math.max(0, yMin - 3), 105])
      .range([height, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''))
      .call(g => g.selectAll('.tick line').attr('stroke', '#e5e7eb').attr('stroke-dasharray', '3,3'))
      .call(g => g.select('.domain').remove());

    // 100% reference line
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', y(100)).attr('y2', y(100))
      .attr('stroke', '#9ca3af')
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(entries.length).tickFormat(d => String(d)))
      .call(g => g.select('.domain').attr('stroke', '#9ca3af'))
      .call(g => g.selectAll('.tick text').attr('fill', '#6b7280').style('font-size', '12px'));

    // Y axis (%)
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d as number).toFixed(0)}%`))
      .call(g => g.select('.domain').attr('stroke', '#9ca3af'))
      .call(g => g.selectAll('.tick text').attr('fill', '#6b7280').style('font-size', '12px'));

    // Line
    const line = d3.line<{ year: number; sau: number; pct: number }>()
      .x(d => x(d.year))
      .y(d => y(d.pct))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(entries)
      .attr('fill', 'none')
      .attr('stroke', 'hsl(100, 56%, 35%)')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Dots
    const dots = g.selectAll('.dot')
      .data(entries)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.pct))
      .attr('r', 5)
      .attr('fill', 'hsl(100, 56%, 35%)')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer');

    // Tooltip group
    const tooltipG = g.append('g').style('display', 'none');
    const tooltipRect = tooltipG.append('rect')
      .attr('rx', 4).attr('ry', 4)
      .attr('fill', 'hsl(0, 0%, 15%)')
      .attr('opacity', 0.9);
    const tooltipText = tooltipG.append('text')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle');

    dots
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('r', 7);
        const label = `${d.pct.toFixed(1)}% (${formatNumberFull(d.sau)} ha)`;
        tooltipText.text(label);
        const bbox = (tooltipText.node() as SVGTextElement).getBBox();
        const px = x(d.year);
        const py = y(d.pct) - 16;
        tooltipRect
          .attr('x', px - bbox.width / 2 - 6)
          .attr('y', py - bbox.height - 4)
          .attr('width', bbox.width + 12)
          .attr('height', bbox.height + 8);
        tooltipText.attr('x', px).attr('y', py - 6);
        tooltipG.style('display', null);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('r', 5);
        tooltipG.style('display', 'none');
      });

    // Title
    svg.append('text')
      .attr('x', dimensions.width / 2)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', 'hsl(100, 20%, 25%)')
      .attr('font-size', '15px')
      .attr('font-weight', '600')
      .text(`SAU - ${regionData.name} (% vs 2016)`);

  }, [regionData, dimensions]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: 'hsl(120, 8%, 98%)' }}
    >
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
    </div>
  );
};
