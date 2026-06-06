const market = require('./market');
const watchlist = require('./watchlist');
const klineGenerator = require('./kline');
const chart = require('./chart');
const indicators = require('./indicators');
const { getStockByCode } = require('./stocks');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function colorPrice(price, basePrice) {
  if (price > basePrice) {
    return COLORS.red + price.toFixed(2) + COLORS.reset;
  } else if (price < basePrice) {
    return COLORS.green + price.toFixed(2) + COLORS.reset;
  }
  return price.toFixed(2);
}

function colorChange(change, changePercent) {
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  const percentStr = changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
  
  if (change > 0) {
    return `${COLORS.red}${changeStr} (${percentStr})${COLORS.reset}`;
  } else if (change < 0) {
    return `${COLORS.green}${changeStr} (${percentStr})${COLORS.reset}`;
  }
  return `${changeStr} (${percentStr})`;
}

function formatVolume(volume) {
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + '亿';
  } else if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + '万';
  }
  return volume.toString();
}

function renderWatchList() {
  const snapshot = market.getSnapshot();
  const elapsed = market.getElapsedSeconds();
  
  console.clear();
  console.log(`${COLORS.bold}📈 股票行情 - 运行时间: ${Math.floor(elapsed / 60)}分${elapsed % 60}秒${COLORS.reset}`);
  console.log('='.repeat(95));
  console.log(`${COLORS.cyan}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'行业'.padEnd(10)}${'现价'.padEnd(12)}${'涨跌'.padEnd(22)}${'开盘'.padEnd(10)}${'最高'.padEnd(10)}${'最低'.padEnd(10)}${'成交量'.padEnd(10)}${COLORS.reset}`);
  console.log('-'.repeat(95));
  
  snapshot.forEach(stock => {
    const priceStr = colorPrice(stock.currentPrice, stock.prevClose);
    const changeStr = colorChange(stock.change, stock.changePercent);
    const openStr = stock.openPrice.toFixed(2).padEnd(10);
    const highStr = colorPrice(stock.high, stock.prevClose);
    const lowStr = colorPrice(stock.low, stock.prevClose);
    const volStr = formatVolume(stock.volume);
    
    console.log(
      `${stock.code.padEnd(10)}${stock.name.padEnd(12)}${stock.industry.padEnd(10)}${priceStr.padEnd(12)}${changeStr.padEnd(22)}${openStr}${highStr.padEnd(10)}${lowStr.padEnd(10)}${volStr}`
    );
  });
  
  console.log('='.repeat(95));
  console.log(`${COLORS.yellow}提示: 按 Ctrl+C 退出${COLORS.reset}`);
}

function renderQuote(code) {
  const stock = market.getStock(code);
  if (!stock) {
    console.log(`${COLORS.red}错误: 未找到股票代码 ${code}${COLORS.reset}`);
    return;
  }
  
  const stockInfo = getStockByCode(code);
  klineGenerator.update();
  
  const priceHistory = market.getPriceHistory(code, 5 * 60 * 1000);
  const kline1min = klineGenerator.getKline(code, '1min', 60);
  const kline5min = klineGenerator.getKline(code, '5min', 30);
  
  const priceData = priceHistory.map(h => ({ price: h.price, volume: h.volume }));
  const ind = indicators.calculateAllIndicators(priceData);
  const latestInd = indicators.getLatestIndicators(priceData);
  
  console.clear();
  console.log(`${COLORS.bold}📊 ${stockInfo.name} (${stock.code}) - ${stockInfo.industry}${COLORS.reset}`);
  console.log('='.repeat(80));
  console.log(`现价: ${colorPrice(stock.currentPrice, stock.prevClose)}    涨跌: ${colorChange(stock.change, stock.changePercent)}`);
  console.log(`开盘: ${stock.openPrice.toFixed(2).padEnd(12)}最高: ${stock.high.toFixed(2).padEnd(12)}最低: ${stock.low.toFixed(2)}`);
  console.log(`昨收: ${stock.prevClose.toFixed(2).padEnd(12)}成交量: ${formatVolume(stock.volume)}`);
  console.log('='.repeat(80));
  
  console.log(`${COLORS.cyan}📈 技术指标${COLORS.reset}`);
  if (latestInd) {
    console.log(`MA5:  ${latestInd.MA5 ? latestInd.MA5.toFixed(2) : '--'}    MA10: ${latestInd.MA10 ? latestInd.MA10.toFixed(2) : '--'}    MA20: ${latestInd.MA20 ? latestInd.MA20.toFixed(2) : '--'}`);
    console.log(`RSI14: ${latestInd.RSI ? latestInd.RSI.toFixed(2) : '--'}    MACD: ${latestInd.MACD ? latestInd.MACD.toFixed(3) : '--'}`);
    console.log(`布林上轨: ${latestInd.BB_Upper ? latestInd.BB_Upper.toFixed(2) : '--'}    布林中轨: ${latestInd.BB_Middle ? latestInd.BB_Middle.toFixed(2) : '--'}    布林下轨: ${latestInd.BB_Lower ? latestInd.BB_Lower.toFixed(2) : '--'}`);
  }
  console.log('='.repeat(80));
  
  console.log(chart.renderPriceChart(priceData, ind, '📈 价格走势 (最近5分钟)'));
  console.log();
  console.log(chart.renderVolumeChart(priceData, 5));
  if (ind && ind.RSI) {
    console.log();
    console.log(chart.renderRSIChart(ind.RSI, 5));
  }
  
  console.log();
  console.log(`${COLORS.yellow}K线数据 (最近5条1分钟K线):${COLORS.reset}`);
  console.log(`${'时间'.padEnd(20)}${'开盘'.padEnd(10)}${'最高'.padEnd(10)}${'最低'.padEnd(10)}${'收盘'.padEnd(10)}${'成交量'}`);
  console.log('-'.repeat(70));
  kline1min.slice(-5).forEach(k => {
    const time = new Date(k.time).toLocaleTimeString('zh-CN');
    const closeColor = k.close >= k.open ? COLORS.red : COLORS.green;
    console.log(
      `${time.padEnd(20)}${k.open.toFixed(2).padEnd(10)}${k.high.toFixed(2).padEnd(10)}${k.low.toFixed(2).padEnd(10)}${closeColor}${k.close.toFixed(2)}${COLORS.reset}    ${formatVolume(k.volume)}`
    );
  });
}

function renderTop(type = 'gain', count = 5) {
  const snapshot = market.getSnapshot();
  let sorted;
  let title;
  
  switch (type) {
    case 'gain':
      sorted = [...snapshot].sort((a, b) => b.changePercent - a.changePercent);
      title = '🏆 涨幅榜 TOP' + count;
      break;
    case 'loss':
      sorted = [...snapshot].sort((a, b) => a.changePercent - b.changePercent);
      title = '📉 跌幅榜 TOP' + count;
      break;
    case 'volume':
      sorted = [...snapshot].sort((a, b) => b.volume - a.volume);
      title = '📊 成交量榜 TOP' + count;
      break;
    default:
      sorted = [...snapshot].sort((a, b) => b.changePercent - a.changePercent);
      title = '🏆 涨幅榜 TOP' + count;
  }
  
  console.log();
  console.log(`${COLORS.bold}${title}${COLORS.reset}`);
  console.log('='.repeat(80));
  console.log(`${COLORS.cyan}${'排名'.padEnd(8)}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'现价'.padEnd(12)}${'涨跌'.padEnd(22)}${'成交量'}`);
  console.log('-'.repeat(80));
  
  sorted.slice(0, count).forEach((stock, index) => {
    const priceStr = colorPrice(stock.currentPrice, stock.prevClose);
    const changeStr = colorChange(stock.change, stock.changePercent);
    const volStr = formatVolume(stock.volume);
    
    console.log(
      `${COLORS.yellow}${(index + 1).toString().padEnd(8)}${COLORS.reset}${stock.code.padEnd(10)}${stock.name.padEnd(12)}${priceStr.padEnd(12)}${changeStr.padEnd(22)}${volStr}`
    );
  });
  
  console.log('='.repeat(80));
}

function renderWatchListFavorites() {
  const favorites = watchlist.list();
  const elapsed = market.getElapsedSeconds();
  
  console.clear();
  console.log(`${COLORS.bold}⭐ 自选股监控 - 运行时间: ${Math.floor(elapsed / 60)}分${elapsed % 60}秒${COLORS.reset}`);
  console.log('='.repeat(80));
  console.log(`${COLORS.cyan}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'现价'.padEnd(12)}${'涨跌'.padEnd(22)}${'开盘'.padEnd(10)}${'最高'.padEnd(10)}${'最低'.padEnd(10)}`);
  console.log('-'.repeat(80));
  
  if (favorites.length === 0) {
    console.log(`${COLORS.yellow}自选股列表为空，使用 watchlist add <code> 添加${COLORS.reset}`);
  } else {
    favorites.forEach(code => {
      const stock = market.getStock(code);
      if (!stock) return;
      
      const priceStr = colorPrice(stock.currentPrice, stock.prevClose);
      const changeStr = colorChange(stock.change, stock.changePercent);
      const openStr = stock.openPrice.toFixed(2).padEnd(10);
      const highStr = colorPrice(stock.high, stock.prevClose);
      const lowStr = colorPrice(stock.low, stock.prevClose);
      
      console.log(
        `${stock.code.padEnd(10)}${stock.name.padEnd(12)}${priceStr.padEnd(12)}${changeStr.padEnd(22)}${openStr}${highStr.padEnd(10)}${lowStr.padEnd(10)}`
      );
    });
  }
  
  console.log('='.repeat(80));
  console.log(`${COLORS.yellow}提示: 按 Ctrl+C 退出 | 共 ${favorites.length} 只自选股${COLORS.reset}`);
}

function renderWatchlistStatic() {
  const quotes = watchlist.getWatchlistQuotes();
  
  console.log();
  console.log(`${COLORS.bold}⭐ 自选股实时行情${COLORS.reset}`);
  console.log('='.repeat(80));
  console.log(`${COLORS.cyan}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'现价'.padEnd(12)}${'涨跌'.padEnd(22)}${'开盘'.padEnd(10)}${'最高'.padEnd(10)}${'最低'.padEnd(10)}`);
  console.log('-'.repeat(80));

  if (quotes.length === 0) {
    console.log(`${COLORS.yellow}自选股列表为空，使用 watchlist add <code> 添加${COLORS.reset}`);
  } else {
    quotes.forEach(stock => {
      const priceStr = colorPrice(stock.currentPrice, stock.prevClose);
      const changeStr = colorChange(stock.change, stock.changePercent);
      const openStr = stock.openPrice.toFixed(2).padEnd(10);
      const highStr = colorPrice(stock.high, stock.prevClose);
      const lowStr = colorPrice(stock.low, stock.prevClose);
      
      console.log(
        `${stock.code.padEnd(10)}${stock.name.padEnd(12)}${priceStr.padEnd(12)}${changeStr.padEnd(22)}${openStr}${highStr.padEnd(10)}${lowStr.padEnd(10)}`
      );
    });
  }

  console.log('='.repeat(80));
  console.log(`共 ${quotes.length} 只自选股`);
  console.log();
}

function renderWatch(options = {}) {
  if (options.top) {
    renderTop(options.top, options.count || 5);
  }
  if (options.quote) {
    renderQuote(options.quote);
  }
  if (options.favorites) {
    renderWatchListFavorites();
  }
  if (!options.top && !options.quote && !options.favorites) {
    renderWatchList();
  }
}

module.exports = {
  renderWatch,
  renderQuote,
  renderTop,
  renderWatchList,
  renderWatchListFavorites,
  renderWatchlistStatic,
  colorPrice,
  colorChange,
  formatVolume,
  COLORS
};
