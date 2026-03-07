import { useMemo, useState, useEffect } from 'react';
import { ControlPanel } from '@/components/ControlPanel';
import { FranceMap } from '@/components/FranceMap';
import { Legend } from '@/components/Legend';
import { Tooltip } from '@/components/Tooltip';
import { StatsPanel } from '@/components/StatsPanel';
import { SauChart } from '@/components/SauChart';
import { SauPieChart } from '@/components/SauPieChart';
import { SankeyChart } from '@/components/SankeyChart';
import { useAppStore } from '@/stores/useAppStore';
import { getDataRange, calculateStats, buildDataForYear } from '@/utils/dataUtils';
import type { RA2020Data, SauByRegionYearData, SauByDepartmentYearData } from '@/types/data';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { level, indicator, sizeFilter, selectedRegion, selectedDepartment, selectedYear } = useAppStore();
  const [data, setData] = useState<RA2020Data | null>(null);
  const [sauData, setSauData] = useState<SauByRegionYearData | null>(null);
  const [sauDeptData, setSauDeptData] = useState<SauByDepartmentYearData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'carte' | 'repartition' | 'sankey'>('carte');

  useEffect(() => {
    Promise.all([
      fetch('/data/ra2020.json').then(res => {
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.json();
      }),
      fetch('/data/sau_by_region_year.json').then(res => {
        if (!res.ok) throw new Error('Failed to fetch SAU data');
        return res.json();
      }),
      fetch('/data/sau_by_department_year.json').then(res => {
        if (!res.ok) throw new Error('Failed to fetch department SAU data');
        return res.json();
      }),
    ])
      .then(([ra2020, sauByRegion, sauByDept]: [RA2020Data, SauByRegionYearData, SauByDepartmentYearData]) => {
        setData(ra2020);
        setSauData(sauByRegion);
        setSauDeptData(sauByDept);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);
  
  const effectiveData = useMemo(() => {
    if (!data || selectedYear === null || !sauData || !sauDeptData) return data;
    return buildDataForYear(data, sauData, sauDeptData, selectedYear);
  }, [data, sauData, sauDeptData, selectedYear]);

  const domain = useMemo(() =>
    effectiveData ? getDataRange(effectiveData, level, indicator, sizeFilter) : [0, 1] as [number, number],
    [effectiveData, level, indicator, sizeFilter]
  );

  const stats = useMemo(() =>
    effectiveData ? calculateStats(effectiveData, level, indicator, sizeFilter) : {
      total: 0,
      average: 0,
      min: { name: '-', value: 0 },
      max: { name: '-', value: 0 },
      count: 0
    },
    [effectiveData, level, indicator, sizeFilter]
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-destructive">
          <p className="text-sm">Erreur: {error || 'Données non disponibles'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ControlPanel />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-border bg-card shrink-0">
          <button
            onClick={() => setActiveTab('carte')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'carte'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Carte
            {activeTab === 'carte' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('repartition')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'repartition'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {indicator === 'sau' ? 'Répartition SAU' : 'Répartition exploitations'}
            {activeTab === 'repartition' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sankey')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'sankey'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Flux par taille
            {activeTab === 'sankey' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {activeTab === 'carte' ? (
          <>
            <div className={`relative overflow-hidden transition-all duration-500 ${(selectedRegion || selectedDepartment) && indicator === 'sau' ? 'h-[55vh]' : 'flex-1'}`}>
              <FranceMap data={effectiveData!} />

              <Legend domain={domain} />
              <StatsPanel stats={stats} />
              <Tooltip />
            </div>

            {selectedRegion && sauData && indicator === 'sau' && (() => {
              const regionSau = sauData.regions.find(r => r.code === selectedRegion);
              if (!regionSau) return null;
              return (
                <div className="h-[45vh] border-t border-border">
                  <SauChart regionData={regionSau} />
                </div>
              );
            })()}

            {selectedDepartment && sauDeptData && indicator === 'sau' && (() => {
              const deptSau = sauDeptData.departments.find(d => d.code === selectedDepartment);
              if (!deptSau) return null;
              return (
                <div className="h-[45vh] border-t border-border">
                  <SauChart regionData={deptSau} />
                </div>
              );
            })()}
          </>
        ) : activeTab === 'repartition' ? (
          <div className="flex-1 overflow-hidden">
            <SauPieChart data={effectiveData!} sauDeptData={sauDeptData} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <SankeyChart data={effectiveData!} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
