import { useAppStore } from '@/stores/useAppStore';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapIcon, BarChart3, Layers, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Indicator, SizeFilter, MapLevel } from '@/types/data';

const years = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024];

const sizeFilters: { value: SizeFilter; label: string }[] = [
  { value: 'all', label: 'Toutes tailles' },
  { value: '[0,20)', label: 'Moins de 20 ha' },
  { value: '[20,50)', label: '20-50 ha' },
  { value: '[50,100)', label: '50-100 ha' },
  { value: '[100,200)', label: '100-200 ha' },
  { value: '[200+)', label: '200 ha et plus' },
];

export const ControlPanel = () => {
  const {
    level,
    setLevel,
    indicator,
    setIndicator,
    sizeFilter,
    setSizeFilter,
    selectedYear,
    setSelectedYear,
    isSidebarOpen,
    toggleSidebar
  } = useAppStore();

  return (
    <>
      {/* Toggle button */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        className="absolute top-4 left-4 z-20 bg-card shadow-card lg:hidden"
      >
        {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      <aside 
        className={`
          fixed lg:relative top-0 left-0 h-full z-10
          w-72 lg:w-80 bg-card border-r border-border
          transition-transform duration-300 ease-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto
        `}
      >
        <div className="p-6 space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <MapIcon className="h-5 w-5" />
              <h1 className="font-display text-xl font-bold">Recensement Agricole</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Données {selectedYear !== null ? `${selectedYear} (SAA)` : '2020 (Recensement)'} • Agreste
            </p>
          </div>

          {/* Level selector */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-accent" />
              Niveau géographique
            </Label>
            <RadioGroup
              value={level}
              onValueChange={(value) => setLevel(value as MapLevel)}
              className="flex gap-2"
            >
              <div className="flex-1">
                <RadioGroupItem
                  value="regions"
                  id="regions"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="regions"
                  className="flex items-center justify-center px-3 py-2.5 text-sm font-medium rounded-lg border-2 border-border cursor-pointer transition-all
                    peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:text-primary
                    hover:bg-muted"
                >
                  Régions
                </Label>
              </div>
              <div className="flex-1">
                <RadioGroupItem
                  value="departments"
                  id="departments"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="departments"
                  className="flex items-center justify-center px-3 py-2.5 text-sm font-medium rounded-lg border-2 border-border cursor-pointer transition-all
                    peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:text-primary
                    hover:bg-muted"
                >
                  Départements
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Indicator selector */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-accent" />
              Indicateur
            </Label>
            <RadioGroup
              value={indicator}
              onValueChange={(value) => setIndicator(value as Indicator)}
              className="flex gap-2"
            >
              <div className="flex-1">
                <RadioGroupItem
                  value="nb_exploitations"
                  id="nb_exploitations"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="nb_exploitations"
                  className="flex items-center justify-center px-3 py-2.5 text-sm font-medium rounded-lg border-2 border-border cursor-pointer transition-all
                    peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:text-primary
                    hover:bg-muted text-center leading-tight"
                >
                  Exploitations
                </Label>
              </div>
              <div className="flex-1">
                <RadioGroupItem
                  value="sau"
                  id="sau"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="sau"
                  className="flex items-center justify-center px-3 py-2.5 text-sm font-medium rounded-lg border-2 border-border cursor-pointer transition-all
                    peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:text-primary
                    hover:bg-muted text-center leading-tight"
                >
                  SAU (ha)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Year selector (SAU only) */}
          {indicator === 'sau' && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-accent" />
                Année
              </Label>
              <Select
                value={selectedYear === null ? 'census' : String(selectedYear)}
                onValueChange={(v) => setSelectedYear(v === 'census' ? null : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="census">2020 (Recensement)</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y} (SAA)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Size filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Taille des exploitations (SAU)</Label>
            <Select
              value={sizeFilter}
              onValueChange={(v) => setSizeFilter(v as SizeFilter)}
              disabled={selectedYear !== null}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedYear !== null && (
              <p className="text-xs text-muted-foreground">
                Le filtre par taille n'est disponible que pour le Recensement 2020.
              </p>
            )}
          </div>

          {/* Info */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>SAU</strong> : Superficie Agricole Utilisée, exprimée en hectares.
              Elle mesure la surface consacrée à la production agricole.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
