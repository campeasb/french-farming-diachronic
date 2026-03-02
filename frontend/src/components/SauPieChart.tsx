import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '@/stores/useAppStore';
import { getValueForArea } from '@/utils/dataUtils';
import { formatNumberFull } from '@/utils/colorScales';
import type { RA2020Data, SauByDepartmentYearData } from '@/types/data';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface SauPieChartProps {
  data: RA2020Data;
  sauDeptData: SauByDepartmentYearData | null;
}

interface SliceData {
  code: string;
  name: string;
  value: number;
}

const SMALL_SLICE_THRESHOLD = 0.02; // 2%

export const SauPieChart = ({ data, sauDeptData }: SauPieChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [drillRegion, setDrillRegion] = useState<{ code: string; name: string } | null>(null);

  const { indicator, sizeFilter } = useAppStore();

  // Build a department code → name lookup from sauDeptData
  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (sauDeptData) {
      for (const d of sauDeptData.departments) {
        map.set(d.code, d.name);
      }
    }
    return map;
  }, [sauDeptData]);

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions(prev =>
        prev.width === Math.round(width) && prev.height === Math.round(height)
          ? prev
          : { width: Math.round(width), height: Math.round(height) }
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Build slice data
  const slices = useMemo((): SliceData[] => {
    if (drillRegion) {
      const depts = data.departments.filter(d => d.region_name === drillRegion.name);
      return depts.map(d => ({
        code: d.code,
        name: deptNameMap.get(d.code) || d.code,
        value: getValueForArea(d, indicator, sizeFilter),
      })).filter(s => s.value > 0);
    }
    return data.regions.map(r => ({
      code: r.code,
      name: r.name,
      value: getValueForArea(r, indicator, sizeFilter),
    })).filter(s => s.value > 0);
  }, [data, drillRegion, indicator, sizeFilter, deptNameMap]);

  // Group small slices into "Autres" and assign red→yellow gradient colors
  const { displaySlices, colorMap } = useMemo(() => {
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return { displaySlices: [], colorMap: new Map<string, string>() };

    const big: SliceData[] = [];
    let autresValue = 0;

    const sorted = [...slices].sort((a, b) => b.value - a.value);
    for (const s of sorted) {
      if (s.value / total < SMALL_SLICE_THRESHOLD) {
        autresValue += s.value;
      } else {
        big.push(s);
      }
    }

    const result: SliceData[] = [...big];
    if (autresValue > 0) {
      result.push({ code: '__autres__', name: 'Autres', value: autresValue });
    }

    // Red→Yellow gradient: index 0 (largest) = red, last = yellow
    const colorScale = d3.scaleLinear<string>()
      .domain([0, Math.max(big.length - 1, 1)])
      .range(['#e03030', '#f5d020'])
      .interpolate(d3.interpolateHsl);

    const cMap = new Map<string, string>();
    result.forEach((s, i) => {
      cMap.set(s.code, s.code === '__autres__' ? '#b0b0b0' : colorScale(i));
    });

    return { displaySlices: result, colorMap: cMap };
  }, [slices]);

  // Render pie chart
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const tooltipEl = tooltipRef.current;

    const { width, height } = dimensions;

    const legendWidth = Math.min(250, width * 0.35);
    const chartAreaWidth = width - legendWidth;
    const chartSize = Math.min(chartAreaWidth, height - 40);
    const outerRadius = (chartSize / 2 - 10) * 0.9;
    const innerRadius = outerRadius * 0.6;
    const cx = chartAreaWidth / 2;
    const cy = height / 2;

    if (outerRadius <= 0) return;

    const total = displaySlices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return;

    const pie = d3.pie<SliceData>()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.015);

    const arc = d3.arc<d3.PieArcDatum<SliceData>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(3);

    const arcHover = d3.arc<d3.PieArcDatum<SliceData>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + 8)
      .cornerRadius(3);

    const arcs = pie(displaySlices);

    const chartG = svg.append('g')
      .attr('transform', `translate(${cx},${cy})`);

    // Slices
    chartG.selectAll('path')
      .data(arcs)
      .join('path')
      .attr('d', arc as any)
      .attr('fill', d => colorMap.get(d.data.code) || '#ccc')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('cursor', d => d.data.code !== '__autres__' && !drillRegion ? 'pointer' : 'default')
      .on('mouseenter', function (_event: MouseEvent, d) {
        d3.select(this)
          .transition().duration(150)
          .attr('d', arcHover(d) as string);

        if (tooltipEl) {
          const pct = ((d.data.value / total) * 100).toFixed(1);
          const unit = indicator === 'sau' ? ' ha' : '';
          tooltipEl.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px">${d.data.name}</div>
            <div style="color:#ccc">${formatNumberFull(d.data.value)}${unit} — ${pct}%</div>
          `;
          tooltipEl.style.display = 'block';
        }
      })
      .on('mousemove', function (event: MouseEvent) {
        if (tooltipEl) {
          const container = containerRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          const x = event.clientX - rect.left + 12;
          const y = event.clientY - rect.top - 10;
          // Prevent overflow on the right
          const tipWidth = tooltipEl.offsetWidth;
          const tipHeight = tooltipEl.offsetHeight;
          const adjustedX = x + tipWidth > rect.width ? x - tipWidth - 24 : x;
          const adjustedY = y + tipHeight > rect.height ? y - tipHeight : y;
          tooltipEl.style.left = `${adjustedX}px`;
          tooltipEl.style.top = `${adjustedY}px`;
        }
      })
      .on('mouseleave', function (_event: MouseEvent, d) {
        d3.select(this)
          .transition().duration(150)
          .attr('d', arc(d) as string);
        if (tooltipEl) {
          tooltipEl.style.display = 'none';
        }
      })
      .on('click', (_event, d) => {
        if (!drillRegion && d.data.code !== '__autres__') {
          setDrillRegion({ code: d.data.code, name: d.data.name });
        }
      });

    // Center text
    const centerG = chartG.append('g').attr('text-anchor', 'middle');
    centerG.append('text')
      .attr('y', -8)
      .attr('fill', 'hsl(0, 0%, 30%)')
      .attr('font-size', '13px')
      .text(indicator === 'sau' ? 'SAU totale' : 'Exploitations');
    centerG.append('text')
      .attr('y', 14)
      .attr('fill', 'hsl(0, 0%, 15%)')
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .text(indicator === 'sau' ? `${formatNumberFull(total)} ha` : formatNumberFull(total));

    // Legend
    const legendG = svg.append('g')
      .attr('transform', `translate(${chartAreaWidth + 8}, ${20})`);

    const legendItemHeight = 24;
    const maxVisible = Math.floor((height - 40) / legendItemHeight);
    const legendData = displaySlices.slice(0, maxVisible);

    legendData.forEach((s, i) => {
      const row = legendG.append('g')
        .attr('transform', `translate(0, ${i * legendItemHeight})`);

      row.append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('rx', 3)
        .attr('fill', colorMap.get(s.code) || '#ccc');

      const pct = ((s.value / total) * 100).toFixed(1);
      row.append('text')
        .attr('x', 20)
        .attr('y', 11)
        .attr('fill', 'hsl(0, 0%, 30%)')
        .attr('font-size', '12px')
        .text(`${s.name} (${pct}%)`);
    });

  }, [displaySlices, colorMap, dimensions, drillRegion, indicator]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: 'hsl(120, 8%, 98%)' }}
    >
      {/* Title */}
      <div className="absolute top-3 left-4 flex items-center gap-3 z-10">
        {drillRegion && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrillRegion(null)}
            className="bg-card shadow-card"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        )}
        <h2 className="text-sm font-semibold text-foreground/80">
          {drillRegion
            ? `Répartition ${indicator === 'sau' ? 'SAU' : 'exploitations'} — ${drillRegion.name}`
            : `Répartition ${indicator === 'sau' ? 'SAU' : 'exploitations'} par région`
          }
        </h2>
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* HTML tooltip that follows the mouse */}
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          background: 'hsl(0, 0%, 12%)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '1.4',
          zIndex: 20,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      />
    </div>
  );
};
