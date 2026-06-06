const EventEmitter = require('events');
const { getStockList } = require('./stocks');
const newsManager = require('./news');

class MarketSimulator extends EventEmitter {
  constructor() {
    super();
    this.stocks = new Map();
    this.priceHistory = new Map();
    this.isRunning = false;
    this.intervalId = null;
    this.startTime = null;
    this.newsImpacts = new Map();
    this._initStocks();
    this._setupNewsListener();
  }

  _setupNewsListener() {
    newsManager.onNews((news) => {
      if (news.type !== 'neutral' && news.target && news.target.targets) {
        news.target.targets.forEach(code => {
          const existing = this.newsImpacts.get(code) || [];
          existing.push({
            impact: news.impact,
            startTime: Date.now(),
            duration: 60 * 1000,
            newsId: news.id
          });
          this.newsImpacts.set(code, existing);
        });
      }
    });
  }

  _applyNewsImpact(code, currentPrice) {
    const impacts = this.newsImpacts.get(code) || [];
    const now = Date.now();
    let totalImpact = 0;
    const activeImpacts = [];

    impacts.forEach(impact => {
      const elapsed = now - impact.startTime;
      if (elapsed < impact.duration) {
        const decay = 1 - (elapsed / impact.duration);
        totalImpact += impact.impact * decay;
        activeImpacts.push(impact);
      }
    });

    this.newsImpacts.set(code, activeImpacts);

    if (totalImpact !== 0) {
      const newPrice = currentPrice * (1 + totalImpact);
      return parseFloat(newPrice.toFixed(2));
    }

    return currentPrice;
  }

  _initStocks() {
    const stockList = getStockList();
    const now = Date.now();
    
    stockList.forEach(stock => {
      const openPrice = stock.basePrice * (0.95 + Math.random() * 0.1);
      const currentPrice = openPrice;
      const high = currentPrice;
      const low = currentPrice;
      
      this.stocks.set(stock.code, {
        ...stock,
        openPrice: parseFloat(openPrice.toFixed(2)),
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        prevClose: parseFloat(stock.basePrice.toFixed(2)),
        volume: 0,
        lastUpdate: now
      });
      
      this.priceHistory.set(stock.code, [{
        time: now,
        price: currentPrice,
        volume: 0
      }]);
    });
  }

  _randomWalk(price, volatility = 0.002) {
    const drift = 0.0001;
    const shock = (Math.random() - 0.5) * 2 * volatility;
    const changePercent = drift + shock;
    const newPrice = price * (1 + changePercent);
    return Math.max(0.01, parseFloat(newPrice.toFixed(2)));
  }

  _updateStock(code) {
    const stock = this.stocks.get(code);
    if (!stock) return;
    
    let newPrice = this._randomWalk(stock.currentPrice);
    newPrice = this._applyNewsImpact(code, newPrice);
    const volumeChange = Math.floor(Math.random() * 10000) + 100;
    
    stock.currentPrice = newPrice;
    stock.high = Math.max(stock.high, newPrice);
    stock.low = Math.min(stock.low, newPrice);
    stock.volume += volumeChange;
    stock.lastUpdate = Date.now();
    
    const history = this.priceHistory.get(code);
    history.push({
      time: stock.lastUpdate,
      price: newPrice,
      volume: volumeChange
    });
    
    if (history.length > 10000) {
      history.shift();
    }
    
    return stock;
  }

  _tick() {
    const codes = Array.from(this.stocks.keys());
    codes.forEach(code => this._updateStock(code));
    this.emit('update', this.getSnapshot());
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();
    this.intervalId = setInterval(() => this._tick(), 1000);
    console.log('📈 行情模拟已启动，价格每秒更新...');
    newsManager.start();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('📉 行情模拟已停止');
    newsManager.stop();
  }

  getActiveNewsImpacts() {
    const result = [];
    const now = Date.now();
    this.newsImpacts.forEach((impacts, code) => {
      impacts.forEach(impact => {
        if (now - impact.startTime < impact.duration) {
          result.push({
            code,
            impact: impact.impact,
            remaining: impact.duration - (now - impact.startTime)
          });
        }
      });
    });
    return result;
  }

  getStock(code) {
    const stock = this.stocks.get(code);
    if (!stock) return null;
    
    const change = stock.currentPrice - stock.prevClose;
    const changePercent = (change / stock.prevClose) * 100;
    
    return {
      ...stock,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2))
    };
  }

  getSnapshot() {
    const snapshot = [];
    const codes = Array.from(this.stocks.keys());
    
    codes.forEach(code => {
      const stock = this.getStock(code);
      if (stock) snapshot.push(stock);
    });
    
    return snapshot;
  }

  getPriceHistory(code, period = null) {
    const history = this.priceHistory.get(code);
    if (!history) return [];
    
    if (period === null) return [...history];
    
    const now = Date.now();
    const startTime = now - period;
    
    return history.filter(h => h.time >= startTime);
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  generateHistoricalData(days = 60) {
    const stockList = getStockList();
    const historicalData = new Map();
    const msPerDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    stockList.forEach(stock => {
      const data = [];
      let price = stock.basePrice;
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now - i * msPerDay);
        const open = price;
        const close = this._randomWalk(price, 0.02);
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        const volume = Math.floor(Math.random() * 10000000) + 1000000;
        
        data.push({
          time: date.getTime(),
          date: date.toISOString().split('T')[0],
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume
        });
        
        price = close;
      }
      
      historicalData.set(stock.code, data);
    });
    
    return historicalData;
  }
}

const market = new MarketSimulator();
module.exports = market;
