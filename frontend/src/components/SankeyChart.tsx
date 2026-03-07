import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
import { useAppStore } from '@/stores/useAppStore';
import { isMetropolitan } from '@/utils/dataUtils';
import { formatNumberFull } from '@/utils/colorScales';
import type { RA2020Data, SauClass } from '@/types/data';

interface SankeyChartProps {
  data: RA2020Data;
}

const SAU_CLASSES: SauClass[] = ['[0,20)', '[20,50)', '[50,100)', '[100,200)', '[200+)'];

const CLASS_LABELS: Record<string, string> = {
  '[0,20)': '0 - 20 ha',
  '[20,50)': '20 - 50 ha',
  '[50,100)': '50 - 100 ha',
  '[100,200)': '100 - 200 ha',
  '[200+)': '200 ha et +',
};

interface SankeyNode {
  name: string;
  id: string;
  type: 'region' | 'class';
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  regionName: string;
  className: string;
}

export const SankeyChart = ({ data }: SankeyChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isolatedRegion, setIsolatedRegion] = useState<string | null>(null);

  const { indicator, selectedYear } = useAppStore();

  // ResizeObserver for responsive sizing
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

  // Check if by_class data is available
  const hasClassData = useMemo(() => {
    const metroRegions = data.regions.filter(isMetropolitan);
    return metroRegions.some(r => Object.keys(r.by_class).length > 0);
  }, [data]);

  // Build sankey data
  const sankeyData = useMemo(() => {
    if (!hasClassData) return null;

    const metroRegions = data.regions
      .filter(isMetropolitan)
      .sort((a, b) => b.total[indicator] - a.total[indicator]);

    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];

    // Region nodes (left side)
    metroRegions.forEach(r => {
      nodes.push({ name: r.name, id: `region-${r.code}`, type: 'region' });
    });

    // Class nodes (right side)
    SAU_CLASSES.forEach(cls => {
      nodes.push({ name: CLASS_LABELS[cls], id: `class-${cls}`, type: 'class' });
    });

    const regionCount = metroRegions.length;

    // Build links
    metroRegions.forEach((r, ri) => {
      SAU_CLASSES.forEach((cls, ci) => {
        const classData = r.by_class[cls];
        if (!classData) return;
        const value = classData[indicator];
        if (value <= 0) return;
        links.push({
          source: ri,
          target: regionCount + ci,
          value,
          regionName: r.name,
          className: CLASS_LABELS[cls],
        });
      });
    });

    return { nodes, links };
  }, [data, indicator, hasClassData]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;
    if (!sankeyData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const tooltipEl = tooltipRef.current;

    const { width, height } = dimensions;
    const margin = { top: 50, right: 160, bottom: 20, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Deep clone to avoid d3-sankey mutation issues
    const nodes = sankeyData.nodes.map(n => ({ ...n }));
    const allLinks = sankeyData.links.map(l => ({ ...l }));

    // Filter links if a region is isolated
    const filteredLinks = isolatedRegion
      ? allLinks.filter(l => {
          const sourceNode = nodes[l.source as number];
          return sourceNode && sourceNode.id === `region-${isolatedRegion}`;
        })
      : allLinks;

    if (filteredLinks.length === 0) return;

    // d3-sankey layout
    const sankeyLayout = d3Sankey<SankeyNode, SankeyLink>()
      .nodeId((d: any) => d.id)
      .nodeWidth(20)
      .nodePadding(12)
      .nodeAlign(sankeyJustify)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Build graph with node references by id
    const nodeMap = new Map<string, any>();
    const graphNodes = nodes.map(n => {
      const gn = { ...n };
      nodeMap.set(n.id, gn);
      return gn;
    });
    const graphLinks = filteredLinks.map(l => ({
      ...l,
      source: graphNodes[l.source as number].id,
      target: graphNodes[l.target as number].id,
    }));

    let graph: any;
    try {
      graph = sankeyLayout({
        nodes: graphNodes,
        links: graphLinks,
      });
    } catch {
      return;
    }

    // Color scales
    const regionColors = d3.scaleOrdinal<string>()
      .domain(nodes.filter(n => n.type === 'region').map(n => n.id))
      .range(d3.schemeTableau10);

    const classColorScale = d3.scaleSequential()
      .domain([0, SAU_CLASSES.length - 1])
      .interpolator(d3.interpolateGreens);

    const getNodeColor = (node: any) => {
      if (node.type === 'class') {
        const idx = SAU_CLASSES.findIndex(c => node.id === `class-${c}`);
        return classColorScale(idx >= 0 ? idx : 0);
      }
      return regionColors(node.id);
    };

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Total for percentage calculations
    const total = filteredLinks.reduce((sum, l) => sum + l.value, 0);

    // Draw links
    const linkGroup = g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.3);

    const linkPaths = linkGroup.selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d: any) => regionColors(d.source.id))
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .style('mix-blend-mode', 'multiply');

    // Draw nodes
    const nodeGroup = g.append('g');

    const nodeRects = nodeGroup.selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => Math.max(1, d.y1 - d.y0))
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('rx', 2)
      .attr('cursor', (d: any) => d.type === 'region' ? 'pointer' : 'default');

    // Node labels
    nodeGroup.selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', (d: any) => d.type === 'region' ? d.x0 - 8 : d.x1 + 8)
      .attr('y', (d: any) => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => d.type === 'region' ? 'end' : 'start')
      .attr('font-size', '11px')
      .attr('fill', 'hsl(0, 0%, 25%)')
      .text((d: any) => d.name);

    // Interactions
    const resetOpacity = () => {
      linkPaths.attr('stroke-opacity', 0.3);
    };

    linkPaths
      .on('mouseenter', function (_event: MouseEvent, d: any) {
        linkPaths.attr('stroke-opacity', (l: any) => l === d ? 0.6 : 0.1);

        if (tooltipEl) {
          const pct = ((d.value / total) * 100).toFixed(1);
          const unit = indicator === 'sau' ? ' ha' : '';
          tooltipEl.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px">${d.source.name} → ${d.target.name}</div>
            <div style="color:#ccc">${formatNumberFull(d.value)}${unit} — ${pct}%</div>
          `;
          tooltipEl.style.display = 'block';
        }
      })
      .on('mousemove', function (event: MouseEvent) {
        if (tooltipEl && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = event.clientX - rect.left + 12;
          const y = event.clientY - rect.top - 10;
          const tipWidth = tooltipEl.offsetWidth;
          const tipHeight = tooltipEl.offsetHeight;
          const adjustedX = x + tipWidth > rect.width ? x - tipWidth - 24 : x;
          const adjustedY = y + tipHeight > rect.height ? y - tipHeight : y;
          tooltipEl.style.left = `${adjustedX}px`;
          tooltipEl.style.top = `${adjustedY}px`;
        }
      })
      .on('mouseleave', function () {
        resetOpacity();
        if (tooltipEl) tooltipEl.style.display = 'none';
      });

    nodeRects
      .on('mouseenter', function (_event: MouseEvent, d: any) {
        const connectedLinks = graph.links.filter(
          (l: any) => l.source === d || l.target === d
        );
        const connectedSet = new Set(connectedLinks);
        linkPaths.attr('stroke-opacity', (l: any) => connectedSet.has(l) ? 0.6 : 0.05);

        if (tooltipEl) {
          const nodeTotal = connectedLinks.reduce((sum: number, l: any) => sum + l.value, 0);
          const pct = ((nodeTotal / total) * 100).toFixed(1);
          const unit = indicator === 'sau' ? ' ha' : '';
          tooltipEl.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px">${d.name}</div>
            <div style="color:#ccc">${formatNumberFull(nodeTotal)}${unit} — ${pct}%</div>
          `;
          tooltipEl.style.display = 'block';
        }
      })
      .on('mousemove', function (event: MouseEvent) {
        if (tooltipEl && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = event.clientX - rect.left + 12;
          const y = event.clientY - rect.top - 10;
          const tipWidth = tooltipEl.offsetWidth;
          const tipHeight = tooltipEl.offsetHeight;
          const adjustedX = x + tipWidth > rect.width ? x - tipWidth - 24 : x;
          const adjustedY = y + tipHeight > rect.height ? y - tipHeight : y;
          tooltipEl.style.left = `${adjustedX}px`;
          tooltipEl.style.top = `${adjustedY}px`;
        }
      })
      .on('mouseleave', function () {
        resetOpacity();
        if (tooltipEl) tooltipEl.style.display = 'none';
      })
      .on('click', (_event: MouseEvent, d: any) => {
        if (d.type !== 'region') return;
        const regionCode = d.id.replace('region-', '');
        setIsolatedRegion(prev => prev === regionCode ? null : regionCode);
      });

  }, [sankeyData, dimensions, isolatedRegion, indicator]);

  // Reset isolation when indicator changes
  useEffect(() => {
    setIsolatedRegion(null);
  }, [indicator]);

  const isolatedRegionName = useMemo(() => {
    if (!isolatedRegion) return null;
    const r = data.regions.find(r => r.code === isolatedRegion);
    return r?.name ?? null;
  }, [isolatedRegion, data]);

  return (
    <div
      className="relative w-full h-full flex flex-col"
      style={{ background: 'hsl(120, 8%, 98%)' }}
    >
      <div className="px-4 py-3 flex items-center gap-3 shrink-0">
        {isolatedRegionName && (
          <button
            onClick={() => setIsolatedRegion(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-border bg-card shadow-sm hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Retour
          </button>
        )}
        <h2 className="text-sm font-semibold text-foreground/80">
          {!hasClassData
            ? 'Structure par taille'
            : isolatedRegionName
              ? `Flux par taille — ${isolatedRegionName}`
              : `Flux par taille — ${indicator === 'sau' ? 'SAU (ha)' : 'Exploitations'}`
          }
        </h2>
      </div>

      {!hasClassData ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-muted-foreground px-8 text-center">
            Les données par taille ne sont disponibles que pour le Recensement 2020.
          </p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="relative flex-1 min-h-0">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
            />
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
          <div className="px-6 py-3 shrink-0 border-t border-border/40">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl mx-auto text-center">
              {indicator === 'sau'
                ? "Ce diagramme montre comment la surface agricole se distribue entre classes de taille. Les grandes exploitations (100\u00A0ha et +) concentrent l'essentiel de la SAU en Ile-de-France, Centre et Hauts-de-France, tandis que les petites structures dominent en Occitanie et PACA — reflet du contraste entre agriculture intensive des grandes plaines et agricultures familiales du Sud."
                : "En nombre d'exploitations, le profil s'inverse : les petites fermes (< 20\u00A0ha) sont majoritaires dans presque toutes les régions. Cela illustre le dualisme de l'agriculture française — beaucoup de petites exploitations en nombre, mais une surface cultivée dominée par les grandes structures."}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
