import type { RA2020Data, RegionData, DepartmentData, SizeFilter, Indicator, SauClass, SauByRegionYearData, SauByDepartmentYearData } from '@/types/data';

// Overseas regions (DOM) not shown on the metropolitan map
const OVERSEAS_REGION_CODES = new Set(['01', '02', '03', '04', '06']);
export const isMetropolitan = (area: RegionData | DepartmentData): boolean => {
  if ('region_name' in area) {
    // department: overseas codes start with 97
    return !area.code.startsWith('97');
  }
  // region
  return !OVERSEAS_REGION_CODES.has(area.code);
};

export const getValueForArea = (
  area: RegionData | DepartmentData,
  indicator: Indicator,
  sizeFilter: SizeFilter
): number => {
  if (sizeFilter === 'all') {
    return area.total[indicator];
  }
  
  const classData = area.by_class[sizeFilter as SauClass];
  return classData ? classData[indicator] : 0;
};

export const getDataRange = (
  data: RA2020Data,
  level: 'regions' | 'departments',
  indicator: Indicator,
  sizeFilter: SizeFilter
): [number, number] => {
  const areas = (level === 'regions' ? data.regions : data.departments).filter(isMetropolitan);

  const values = areas.map(area => getValueForArea(area, indicator, sizeFilter));
  const validValues = values.filter(v => v > 0);
  
  if (validValues.length === 0) return [0, 1];
  
  return [Math.min(...validValues), Math.max(...validValues)];
};

export const calculateStats = (
  data: RA2020Data,
  level: 'regions' | 'departments',
  indicator: Indicator,
  sizeFilter: SizeFilter
) => {
  const areas = (level === 'regions' ? data.regions : data.departments).filter(isMetropolitan);

  const values = areas.map(area => ({
    name: 'name' in area ? area.name : area.code,
    value: getValueForArea(area, indicator, sizeFilter)
  })).filter(v => v.value > 0);
  
  if (values.length === 0) {
    return {
      total: 0,
      average: 0,
      min: { name: '-', value: 0 },
      max: { name: '-', value: 0 },
      count: 0
    };
  }
  
  const total = values.reduce((sum, v) => sum + v.value, 0);
  const average = total / values.length;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  
  return {
    total,
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: values.length
  };
};

export const buildDataForYear = (
  ra2020: RA2020Data,
  sauRegionData: SauByRegionYearData,
  sauDeptData: SauByDepartmentYearData,
  year: number,
): RA2020Data => {
  const yearKey = String(year);

  const regions: RegionData[] = ra2020.regions.map((r) => {
    const sauRegion = sauRegionData.regions.find((sr) => sr.code === r.code);
    const sau = sauRegion?.sau_by_year[yearKey] ?? 0;
    return {
      code: r.code,
      name: r.name,
      total: { nb_exploitations: 0, sau },
      by_class: {},
    };
  });

  const departments: DepartmentData[] = ra2020.departments.map((d) => {
    const sauDept = sauDeptData.departments.find((sd) => sd.code === d.code);
    const sau = sauDept?.sau_by_year[yearKey] ?? 0;
    return {
      code: d.code,
      region_name: d.region_name,
      total: { nb_exploitations: 0, sau },
      by_class: {},
    };
  });

  const nationalSau = sauRegionData.national.sau_by_year[yearKey] ?? 0;

  return {
    metadata: ra2020.metadata,
    national: {
      total: { nb_exploitations: 0, sau: nationalSau },
      by_class: {} as RA2020Data['national']['by_class'],
    },
    regions,
    departments,
  };
};

// Mapping from region code to region name for departments
export const getRegionForDepartment = (
  data: RA2020Data,
  deptCode: string
): RegionData | undefined => {
  const dept = data.departments.find(d => d.code === deptCode);
  if (!dept) return undefined;
  
  return data.regions.find(r => r.name === dept.region_name);
};

export const getDepartmentsForRegion = (
  data: RA2020Data,
  regionName: string
): DepartmentData[] => {
  return data.departments.filter(d => d.region_name === regionName);
};
