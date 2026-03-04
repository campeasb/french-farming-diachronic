import * as d3 from 'd3';

export const createColorScale = (domain: [number, number]) => {
  return d3.scaleSequential()
    .domain(domain)
    .interpolator(d3.interpolate('#e0f5ee', '#1a6350'));
};

export const formatNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString('fr-FR');
};

export const formatNumberFull = (value: number): string => {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
};

export const formatHectares = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M ha`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k ha`;
  }
  return `${value.toFixed(0)} ha`;
};
