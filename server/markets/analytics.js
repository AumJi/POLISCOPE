function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function calculateMovingAverage(observations, period) {
  return observations.map((observation, index) => {
    const window = observations.slice(Math.max(0, index - period + 1), index + 1).map((item) => item.close).filter(Number.isFinite);
    return { date: observation.priceDate, value: window.length >= Math.min(period, 2) ? average(window) : null };
  });
}

export function calculateVolatility(observations) {
  const returns = [];
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1].close;
    const current = observations[index].close;
    if (previous > 0 && current > 0) returns.push((current - previous) / previous);
  }
  if (returns.length < 2) return null;
  const mean = average(returns);
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

export function calculateMarketAnalytics(observations) {
  const sorted = [...(observations || [])].filter((item) => Number.isFinite(Number(item.close))).sort((a, b) => a.priceDate.localeCompare(b.priceDate));
  const earliest = sorted[0] || null;
  const latest = sorted.at(-1) || null;
  const percentageChange = earliest && earliest.close > 0 ? ((latest.close - earliest.close) / earliest.close) * 100 : null;

  return {
    available: sorted.length > 0,
    observationCount: sorted.length,
    earliestDate: earliest?.priceDate || null,
    latestDate: latest?.priceDate || null,
    earliestClose: earliest?.close ?? null,
    latestClose: latest?.close ?? null,
    percentageChange,
    volatility: calculateVolatility(sorted),
    sma7: calculateMovingAverage(sorted, 7).at(-1)?.value ?? null,
    sma30: calculateMovingAverage(sorted, 30).at(-1)?.value ?? null,
    movingAverages: {
      sma7: calculateMovingAverage(sorted, 7),
      sma30: calculateMovingAverage(sorted, 30),
    },
  };
}
