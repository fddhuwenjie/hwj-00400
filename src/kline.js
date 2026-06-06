const market = require('./market');
const { getStockCodes } = require('./stocks');

class KlineGenerator {
  constructor() {
    this.klineData = new Map();
    this._initKlineData();
  }

  _initKlineData() {
    const codes = getStockCodes();
    codes.forEach(code => {
      this.klineData.set(code, {
        '1min': [],
        '5min': [],
        'day': []
      });
    });
  }

  aggregateKline(code, type, history) {
    if (!history || history.length === 0) return [];
    
    const klines = [];
    let intervalMs;
    
    switch (type) {
      case '1min':
        intervalMs = 60 * 1000;
        break;
      case '5min':
        intervalMs = 5 * 60 * 1000;
        break;
      case 'day':
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      default:
        intervalMs = 60 * 1000;
    }
    
    let currentIntervalStart = Math.floor(history[0].time / intervalMs) * intervalMs;
    let currentKline = null;
    
    history.forEach(tick => {
      const tickInterval = Math.floor(tick.time / intervalMs) * intervalMs;
      
      if (tickInterval > currentIntervalStart) {
        if (currentKline) {
          klines.push(currentKline);
        }
        currentIntervalStart = tickInterval;
        currentKline = {
          time: currentIntervalStart,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume
        };
      } else if (tickInterval === currentIntervalStart) {
        if (!currentKline) {
          currentKline = {
            time: currentIntervalStart,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: tick.volume
          };
        } else {
          currentKline.high = Math.max(currentKline.high, tick.price);
          currentKline.low = Math.min(currentKline.low, tick.price);
          currentKline.close = tick.price;
          currentKline.volume += tick.volume;
        }
      }
    });
    
    if (currentKline) {
      klines.push(currentKline);
    }
    
    return klines;
  }

  update() {
    const codes = getStockCodes();
    
    codes.forEach(code => {
      const history = market.getPriceHistory(code);
      const klineTypes = ['1min', '5min', 'day'];
      
      klineTypes.forEach(type => {
        this.klineData.get(code)[type] = this.aggregateKline(code, type, history);
      });
    });
  }

  getKline(code, type = '1min', limit = 100) {
    const codeData = this.klineData.get(code);
    if (!codeData) return [];
    
    const data = codeData[type] || [];
    if (limit && limit < data.length) {
      return data.slice(data.length - limit);
    }
    return [...data];
  }

  getAllKlines(type = 'day', limit = 100) {
    const result = new Map();
    const codes = getStockCodes();
    
    codes.forEach(code => {
      result.set(code, this.getKline(code, type, limit));
    });
    
    return result;
  }
}

const klineGenerator = new KlineGenerator();
module.exports = klineGenerator;
