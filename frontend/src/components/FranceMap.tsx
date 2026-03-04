import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { useAppStore } from '@/stores/useAppStore';
import { createColorScale } from '@/utils/colorScales';
import { getValueForArea, getDataRange } from '@/utils/dataUtils';
import type { RA2020Data, RegionData, DepartmentData } from '@/types/data';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface FranceMapProps {
  data: RA2020Data;
}

// TopoJSON URLs for France
const REGIONS_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.geojson';
const DEPARTMENTS_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson';

export const FranceMap = ({ data }: FranceMapProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<{ regions: any; departments: any } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  
  const {
    level,
    indicator,
    sizeFilter,
    setTooltip,
    selectedRegion,
    setSelectedRegion,
    selectedDepartment,
    setSelectedDepartment
  } = useAppStore();

  // Load GeoJSON data
  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const [regionsRes, departmentsRes] = await Promise.all([
          fetch(REGIONS_URL),
          fetch(DEPARTMENTS_URL)
        ]);
        
        const regions = await regionsRes.json();
        const departments = await departmentsRes.json();
        
        setGeoData({ regions, departments });
        setLoading(false);
      } catch (error) {
        console.error('Failed to load geo data:', error);
        setLoading(false);
      }
    };
    
    loadGeoData();
  }, []);

  // Find data for a geographic feature
  const findDataForFeature = useCallback((feature: any): RegionData | DepartmentData | null => {
    const code = feature.properties.code;
    
    if (level === 'regions') {
      return data.regions.find(r => r.code === code) || null;
    } else {
      return data.departments.find(d => d.code === code) || null;
    }
  }, [data, level]);

  // Render map
  useEffect(() => {
    if (!geoData || !svgRef.current || containerSize.width === 0 || containerSize.height === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerSize;

    svg.selectAll('*').remove();

    // Get current geo features
    const currentGeo = level === 'regions' ? geoData.regions : geoData.departments;
    let features = currentGeo.features;

    // Filter by selected region if in department view
    if (level === 'departments' && selectedRegion) {
      const selectedRegionData = data.regions.find(r => r.code === selectedRegion);
      if (selectedRegionData) {
        features = features.filter((f: any) => {
          const dept = data.departments.find(d => d.code === f.properties.code);
          return dept?.region_name === selectedRegionData.name;
        });
      }
    }

    // Calculate color domain
    const [minVal, maxVal] = getDataRange(data, level, indicator, sizeFilter);
    const colorScale = createColorScale([minVal, maxVal]);

    // Create projection
    const projection = d3.geoMercator()
      .fitSize([width - 40, height - 80], {
        type: 'FeatureCollection',
        features
      } as any);

    const pathGenerator = d3.geoPath().projection(projection);

    // Create main group
    const g = svg.append('g');

    // Draw features
    g.selectAll('path')
      .data(features)
      .join('path')
      .attr('d', pathGenerator as any)
      .attr('fill', (d: any) => {
        const areaData = findDataForFeature(d);
        if (!areaData) return '#e5e5e5';
        const value = getValueForArea(areaData, indicator, sizeFilter);
        return value > 0 ? colorScale(value) : '#e5e5e5';
      })
      .attr('stroke', (d: any) => {
        const code = d.properties.code;
        const isSelected = (level === 'regions' && selectedRegion === code) ||
          (level === 'departments' && selectedDepartment === code);
        return isSelected ? 'hsl(100, 56%, 21%)' : 'hsl(100, 10%, 70%)';
      })
      .attr('stroke-width', (d: any) => {
        const code = d.properties.code;
        const isSelected = (level === 'regions' && selectedRegion === code) ||
          (level === 'departments' && selectedDepartment === code);
        return isSelected ? 3 : level === 'regions' ? 1.5 : 0.5;
      })
      .attr('cursor', indicator === 'nb_exploitations' ? 'default' : 'pointer')
      .style('transition', 'fill 0.2s ease, stroke-width 0.2s ease')
      .on('mouseenter', function(event: MouseEvent, d: any) {
        d3.select(this)
          .attr('stroke', 'hsl(100, 56%, 21%)')
          .attr('stroke-width', level === 'regions' ? 2.5 : 1.5)
          .raise();
        
        const areaData = findDataForFeature(d);
        if (areaData) {
          const name = 'name' in areaData ? areaData.name : `${areaData.code} - ${d.properties.nom}`;
          const value = getValueForArea(areaData, indicator, sizeFilter);
          
          setTooltip({
            name,
            code: areaData.code,
            nb_exploitations: sizeFilter === 'all' 
              ? areaData.total.nb_exploitations 
              : (areaData.by_class[sizeFilter as keyof typeof areaData.by_class]?.nb_exploitations || 0),
            sau: sizeFilter === 'all'
              ? areaData.total.sau
              : (areaData.by_class[sizeFilter as keyof typeof areaData.by_class]?.sau || 0),
            x: event.clientX,
            y: event.clientY
          });
        }
      })
      .on('mousemove', function(event: MouseEvent, d: any) {
        const areaData = findDataForFeature(d);
        if (areaData) {
          const name = 'name' in areaData ? areaData.name : `${areaData.code} - ${d.properties.nom}`;
          setTooltip({
            name,
            code: areaData.code,
            nb_exploitations: sizeFilter === 'all' 
              ? areaData.total.nb_exploitations 
              : (areaData.by_class[sizeFilter as keyof typeof areaData.by_class]?.nb_exploitations || 0),
            sau: sizeFilter === 'all'
              ? areaData.total.sau
              : (areaData.by_class[sizeFilter as keyof typeof areaData.by_class]?.sau || 0),
            x: event.clientX,
            y: event.clientY
          });
        }
      })
      .on('mouseleave', function(event: MouseEvent, d: any) {
        const code = d.properties.code;
        const isSelected = (level === 'regions' && selectedRegion === code) ||
          (level === 'departments' && selectedDepartment === code);
        d3.select(this)
          .attr('stroke', isSelected ? 'hsl(100, 56%, 21%)' : 'hsl(100, 10%, 70%)')
          .attr('stroke-width', isSelected ? 3 : (level === 'regions' ? 1.5 : 0.5));
        setTooltip(null);
      })
      .on('click', (_event: MouseEvent, d: any) => {
        if (indicator === 'nb_exploitations') {
          toast("Détail non disponible", {
            description: "L'évolution temporelle n'est disponible que pour l'indicateur SAU.",
            duration: 3000,
          });
          return;
        }
        const code = d.properties.code;
        if (level === 'regions') {
          const current = useAppStore.getState().selectedRegion;
          setSelectedRegion(current === code ? null : code);
        } else if (level === 'departments') {
          const current = useAppStore.getState().selectedDepartment;
          setSelectedDepartment(current === code ? null : code);
        }
      });

  }, [geoData, data, level, indicator, sizeFilter, selectedRegion, selectedDepartment, findDataForFeature, setTooltip, setSelectedRegion, setSelectedDepartment, containerSize]);

  // Track container size via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize(prev =>
        prev.width === Math.round(width) && prev.height === Math.round(height)
          ? prev
          : { width: Math.round(width), height: Math.round(height) }
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [loading]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* Back button when a region is selected */}
      {selectedRegion && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedRegion(null)}
          className="absolute top-4 left-4 z-10 bg-card shadow-card"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: 'hsl(120, 8%, 98%)' }}
      />
    </div>
  );
};
