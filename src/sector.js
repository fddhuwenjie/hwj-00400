const market = require('./market');
const { getSectors, getStocksBySector, SECTORS } = require('./stocks');

class SectorAnalyzer {
  constructor() {
    this.volumeHistory = new Map();
    this._initVolumeHistory();
  }

  _initVolumeHistory() {
    getSectors().forEach(sector => {
      this.volumeHistory.set(sector, []);
    });
  }

  _calculateWeightedChange(stocks) {
    if (!stocks || stocks.length === 0) {
      return { change: 0, changePercent: 0 };
    }

    let totalMarketCap = 0;
    let weightedChangeSum = 0;
    let weightedPercentSum = 0;

    stocks.forEach(stock => {
      const marketCap = stock.currentPrice * 1000000;
      totalMarketCap += marketCap;
      weightedChangeSum += stock.change * marketCap;
      weightedPercentSum += stock.changePercent * marketCap;
    });

    if (totalMarketCap === 0) {
      return { change: 0, changePercent: 0 };
    }

    return {
      change: parseFloat((weightedChangeSum / totalMarketCap).toFixed(2)),
      changePercent: parseFloat((weightedPercentSum / totalMarketCap).toFixed(2))
    };
  }

  _calculateSectorVolume(stocks) {
    if (!stocks || stocks.length === 0) return 0;
    return stocks.reduce((sum, stock) => sum + (stock.volume || 0), 0);
  }

  updateVolumeHistory() {
    const snapshot = market.getSnapshot();
    const sectorStocks = this._groupBySector(snapshot);

    getSectors().forEach(sector => {
      const stocks = sectorStocks.get(sector) || [];
      const volume = this._calculateSectorVolume(stocks);
      const history = this.volumeHistory.get(sector) || [];

      history.push({
        time: Date.now(),
        volume
      });

      if (history.length > 60) {
        history.shift();
      }

      this.volumeHistory.set(sector, history);
    });
  }

  _groupBySector(snapshot) {
    const grouped = new Map();

    getSectors().forEach(sector => {
      grouped.set(sector, []);
    });

    snapshot.forEach(stock => {
      const sector = stock.sector;
      if (grouped.has(sector)) {
        grouped.get(sector).push(stock);
      }
    });

    return grouped;
  }

  getSectorOverview() {
    const snapshot = market.getSnapshot();
    const sectorStocks = this._groupBySector(snapshot);
    const result = [];

    this.updateVolumeHistory();

    getSectors().forEach(sector => {
      const stocks = sectorStocks.get(sector) || [];
      const weighted = this._calculateWeightedChange(stocks);
      const totalVolume = this._calculateSectorVolume(stocks);
      const volumeTrend = this._getVolumeTrend(sector);
      const moneyFlow = this._calculateMoneyFlow(stocks);

      result.push({
        sector,
        stockCount: stocks.length,
        stocks,
        change: weighted.change,
        changePercent: weighted.changePercent,
        totalVolume,
        volumeTrend,
        moneyFlow,
        avgPrice: stocks.length > 0
          ? parseFloat((stocks.reduce((sum, s) => sum + s.currentPrice, 0) / stocks.length).toFixed(2))
          : 0
      });
    });

    return result.sort((a, b) => b.changePercent - a.changePercent);
  }

  getSectorDetail(sectorName) {
    if (!SECTORS.includes(sectorName)) {
      return null;
    }

    const snapshot = market.getSnapshot();
    const stocks = snapshot.filter(s => s.sector === sectorName);
    const weighted = this._calculateWeightedChange(stocks);
    const totalVolume = this._calculateSectorVolume(stocks);
    const volumeTrend = this._getVolumeTrend(sectorName);
    const moneyFlow = this._calculateMoneyFlow(stocks);

    const gainers = [...stocks].filter(s => s.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent);
    const losers = [...stocks].filter(s => s.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent);

    return {
      sector: sectorName,
      stockCount: stocks.length,
      change: weighted.change,
      changePercent: weighted.changePercent,
      totalVolume,
      volumeTrend,
      moneyFlow,
      stocks: stocks.sort((a, b) => b.changePercent - a.changePercent),
      topGainers: gainers.slice(0, 3),
      topLosers: losers.slice(0, 3),
      volumeHistory: this.volumeHistory.get(sectorName) || []
    };
  }

  _getVolumeTrend(sectorName) {
    const history = this.volumeHistory.get(sectorName) || [];
    if (history.length < 2) return { trend: 'stable', change: 0 };

    const recent = history.slice(-5);
    const earlier = history.slice(-10, -5);

    if (earlier.length === 0) return { trend: 'stable', change: 0 };

    const recentAvg = recent.reduce((sum, h) => sum + h.volume, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, h) => sum + h.volume, 0) / earlier.length;

    const change = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;

    let trend = 'stable';
    if (change > 10) trend = 'increasing';
    else if (change < -10) trend = 'decreasing';

    return {
      trend,
      change: parseFloat(change.toFixed(2)),
      recentAvg: Math.round(recentAvg),
      earlierAvg: Math.round(earlierAvg)
    };
  }

  _calculateMoneyFlow(stocks) {
    let inflow = 0;
    let outflow = 0;

    stocks.forEach(stock => {
      const amount = stock.currentPrice * (stock.volume || 0);
      if (stock.changePercent >= 0) {
        inflow += amount;
      } else {
        outflow += amount;
      }
    });

    const netFlow = inflow - outflow;
    return {
      inflow: Math.round(inflow),
      outflow: Math.round(outflow),
      netFlow: Math.round(netFlow)
    };
  }

  getSectorRankings(type = 'gain') {
    const overview = this.getSectorOverview();

    switch (type) {
      case 'gain':
        return overview.sort((a, b) => b.changePercent - a.changePercent);
      case 'loss':
        return overview.sort((a, b) => a.changePercent - b.changePercent);
      case 'volume':
        return overview.sort((a, b) => b.totalVolume - a.totalVolume);
      case 'moneyFlow':
        return overview.sort((a, b) => b.moneyFlow.netFlow - a.moneyFlow.netFlow);
      default:
        return overview.sort((a, b) => b.changePercent - a.changePercent);
    }
  }
}

const sectorAnalyzer = new SectorAnalyzer();
module.exports = sectorAnalyzer;
