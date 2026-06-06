const storage = require('./storage');
const market = require('./market');
const { getStockByCode } = require('./stocks');

class Watchlist {
  constructor() {
    this.stocks = storage.loadWatchlist();
  }

  save() {
    storage.saveWatchlist(this.stocks);
  }

  add(code) {
    const stockInfo = getStockByCode(code);
    if (!stockInfo) {
      return { success: false, message: `股票不存在: ${code}` };
    }

    if (this.stocks.includes(code)) {
      return { success: false, message: `股票已在自选列表中: ${code}` };
    }

    this.stocks.push(code);
    this.save();
    return { success: true, message: `已添加 ${stockInfo.name} (${code}) 到自选股` };
  }

  remove(code) {
    const index = this.stocks.indexOf(code);
    if (index === -1) {
      return { success: false, message: `股票不在自选列表中: ${code}` };
    }

    const stockInfo = getStockByCode(code);
    this.stocks.splice(index, 1);
    this.save();
    return { success: true, message: `已从自选股移除 ${stockInfo ? stockInfo.name : code} (${code})` };
  }

  list() {
    return [...this.stocks];
  }

  getWatchlistQuotes() {
    const quotes = [];
    this.stocks.forEach(code => {
      const stock = market.getStock(code);
      if (stock) {
        quotes.push(stock);
      }
    });
    return quotes;
  }

  reset() {
    this.stocks = [];
    this.save();
  }
}

const watchlist = new Watchlist();
module.exports = watchlist;
