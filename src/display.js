const market = require('./market');
const watchlist = require('./watchlist');
const klineGenerator = require('./kline');
const chart = require('./chart');
const indicators = require('./indicators');
const newsManager = require('./news');
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

function formatMoney(amount) {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(2) + '亿';
  } else if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + '万';
  }
  return amount.toString();
}

function renderSectorOverview(sectors) {
  console.log();
  console.log(`${COLORS.bold}🏭 板块行情 - 涨跌幅排名${COLORS.reset}`);
  console.log('='.repeat(100));
  console.log(`${COLORS.cyan}${'排名'.padEnd(6)}${'板块'.padEnd(10)}${'个股数'.padEnd(8)}${'加权涨跌'.padEnd(20)}${'平均价格'.padEnd(12)}${'成交量'.padEnd(14)}${'资金流向'.padEnd(18)}${'量能趋势'}${COLORS.reset}`);
  console.log('-'.repeat(100));

  sectors.forEach((sector, index) => {
    const changeStr = colorChange(sector.change, sector.changePercent);
    const volStr = formatVolume(sector.totalVolume);

    const moneyFlow = sector.moneyFlow.netFlow;
    const mfColor = moneyFlow > 0 ? COLORS.red : moneyFlow < 0 ? COLORS.green : COLORS.reset;
    const mfStr = `${mfColor}${moneyFlow > 0 ? '+' : ''}${formatMoney(moneyFlow)}${COLORS.reset}`;

    const trend = sector.volumeTrend;
    let trendStr = '→ 平稳';
    let trendColor = COLORS.reset;
    if (trend.trend === 'increasing') {
      trendStr = `↗ 放量 +${trend.change}%`;
      trendColor = COLORS.red;
    } else if (trend.trend === 'decreasing') {
      trendStr = `↘ 缩量 ${trend.change}%`;
      trendColor = COLORS.green;
    }

    console.log(
      `${COLORS.yellow}${(index + 1).toString().padEnd(6)}${COLORS.reset}` +
      `${sector.sector.padEnd(10)}` +
      `${sector.stockCount.toString().padEnd(8)}` +
      `${changeStr.padEnd(20)}` +
      `${sector.avgPrice.toFixed(2).padEnd(12)}` +
      `${volStr.padEnd(14)}` +
      `${mfStr.padEnd(18)}` +
      `${trendColor}${trendStr}${COLORS.reset}`
    );
  });

  console.log('='.repeat(100));
  console.log(`${COLORS.cyan}💡 提示: sector detail <板块名> 查看板块详情${COLORS.reset}`);
  console.log();
}

function renderSectorDetail(detail) {
  console.log();
  console.log(`${COLORS.bold}🏭 板块详情 - ${detail.sector}${COLORS.reset}`);
  console.log('='.repeat(100));
  console.log(`加权涨跌: ${colorChange(detail.change, detail.changePercent)}    个股数: ${detail.stockCount}    成交量: ${formatVolume(detail.totalVolume)}`);

  const moneyFlow = detail.moneyFlow;
  const mfColor = moneyFlow.netFlow > 0 ? COLORS.red : moneyFlow.netFlow < 0 ? COLORS.green : COLORS.reset;
  console.log(`资金流入: ${COLORS.red}${formatMoney(moneyFlow.inflow)}${COLORS.reset}    资金流出: ${COLORS.green}${formatMoney(moneyFlow.outflow)}${COLORS.reset}    净额: ${mfColor}${moneyFlow.netFlow > 0 ? '+' : ''}${formatMoney(moneyFlow.netFlow)}${COLORS.reset}`);

  const trend = detail.volumeTrend;
  let trendStr = '平稳';
  if (trend.trend === 'increasing') trendStr = `放量 (+${trend.change}%)`;
  else if (trend.trend === 'decreasing') trendStr = `缩量 (${trend.change}%)`;
  const recentAvg = trend.recentAvg || 0;
  console.log(`量能趋势: ${trendStr}    近期均量: ${formatVolume(recentAvg)}`);

  console.log('='.repeat(100));

  if (detail.topGainers.length > 0) {
    console.log();
    console.log(`${COLORS.red}📈 板块领涨 (TOP3)${COLORS.reset}`);
    console.log('-'.repeat(80));
    detail.topGainers.forEach((stock, i) => {
      console.log(`${i + 1}. ${stock.code} ${stock.name}  ${colorPrice(stock.currentPrice, stock.prevClose)}  ${colorChange(stock.change, stock.changePercent)}`);
    });
  }

  if (detail.topLosers.length > 0) {
    console.log();
    console.log(`${COLORS.green}📉 板块领跌 (TOP3)${COLORS.reset}`);
    console.log('-'.repeat(80));
    detail.topLosers.forEach((stock, i) => {
      console.log(`${i + 1}. ${stock.code} ${stock.name}  ${colorPrice(stock.currentPrice, stock.prevClose)}  ${colorChange(stock.change, stock.changePercent)}`);
    });
  }

  console.log();
  console.log(`${COLORS.cyan}📋 板块个股列表${COLORS.reset}`);
  console.log('='.repeat(100));
  console.log(`${COLORS.cyan}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'现价'.padEnd(12)}${'涨跌'.padEnd(22)}${'成交量'.padEnd(14)}${'RSI'.padEnd(10)}${'换手率'}${COLORS.reset}`);
  console.log('-'.repeat(100));

  detail.stocks.forEach(stock => {
    const priceStr = colorPrice(stock.currentPrice, stock.prevClose);
    const changeStr = colorChange(stock.change, stock.changePercent);
    const volStr = formatVolume(stock.volume);
    const turnover = ((stock.volume / 10000000) * 100).toFixed(2) + '%';

    console.log(
      `${stock.code.padEnd(10)}` +
      `${stock.name.padEnd(12)}` +
      `${priceStr.padEnd(12)}` +
      `${changeStr.padEnd(22)}` +
      `${volStr.padEnd(14)}` +
      `${'--'.padEnd(10)}` +
      `${turnover}`
    );
  });

  console.log('='.repeat(100));
  console.log();
}

function renderScreenTemplates(templates) {
  console.log();
  console.log(`${COLORS.bold}🔍 选股策略模板${COLORS.reset}`);
  console.log('='.repeat(100));
  console.log(`${COLORS.cyan}${'模板ID'.padEnd(20)}${'名称'.padEnd(12)}${'描述'}${COLORS.reset}`);
  console.log('-'.repeat(100));

  templates.forEach(tpl => {
    console.log();
    console.log(`${COLORS.yellow}${tpl.id.padEnd(20)}${COLORS.reset}${COLORS.cyan}${tpl.name.padEnd(12)}${COLORS.reset}${tpl.description}`);
    console.log(`  条件: ${tpl.conditions.map(c => {
      const field2 = c.field2 ? c.field2 : c.value;
      return `${c.field} ${c.operator} ${field2}`;
    }).join(' AND ')}`);
  });

  console.log();
  console.log('='.repeat(100));
  console.log(`${COLORS.cyan}💡 用法: screen run <模板ID> 或 screen <条件表达式>${COLORS.reset}`);
  console.log(`${COLORS.cyan}   例如: screen run volume_breakout${COLORS.reset}`);
  console.log(`${COLORS.cyan}   例如: screen "涨幅>3% AND 成交量>2倍 AND RSI<70"${COLORS.reset}`);
  console.log();
}

function renderScreenResult(result) {
  console.log();
  if (result.template) {
    console.log(`${COLORS.bold}🔍 选股结果 - ${result.template}${COLORS.reset}`);
    console.log(`策略描述: ${result.description}`);
  } else {
    console.log(`${COLORS.bold}🔍 条件选股结果${COLORS.reset}`);
    console.log(`筛选条件: ${result.expression}`);
  }
  console.log(`符合条件股票: ${result.count} 只`);
  console.log('='.repeat(100));

  if (result.count === 0) {
    console.log(`${COLORS.yellow}暂无符合条件的股票${COLORS.reset}`);
  } else {
    console.log(`${COLORS.cyan}${'排名'.padEnd(6)}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'现价'.padEnd(12)}${'涨跌'.padEnd(22)}${'量比'.padEnd(10)}${'RSI'.padEnd(10)}${'MACD柱'}${COLORS.reset}`);
    console.log('-'.repeat(100));

    result.stocks.forEach((stock, index) => {
      const priceStr = colorPrice(stock.currentPrice, stock.prevClose);
      const changeStr = colorChange(stock.change, stock.changePercent);
      const vrStr = stock.volumeRatio ? stock.volumeRatio.toFixed(2) : '--';
      const rsiStr = stock.RSI ? stock.RSI.toFixed(1) : '--';
      const macdStr = stock.MACD_Histogram ? (stock.MACD_Histogram > 0 ? '+' : '') + stock.MACD_Histogram.toFixed(2) : '--';
      const macdColor = stock.MACD_Histogram > 0 ? COLORS.red : stock.MACD_Histogram < 0 ? COLORS.green : COLORS.reset;

      console.log(
        `${COLORS.yellow}${(index + 1).toString().padEnd(6)}${COLORS.reset}` +
        `${stock.code.padEnd(10)}` +
        `${stock.name.padEnd(12)}` +
        `${priceStr.padEnd(12)}` +
        `${changeStr.padEnd(22)}` +
        `${vrStr.padEnd(10)}` +
        `${rsiStr.padEnd(10)}` +
        `${macdColor}${macdStr}${COLORS.reset}`
      );
    });
  }

  console.log('='.repeat(100));
  console.log();
}

function renderNewsList(news) {
  console.log();
  console.log(`${COLORS.bold}📰 市场新闻 (最近${news.length}条)${COLORS.reset}`);
  console.log('='.repeat(100));
  console.log(`${COLORS.cyan}${'时间'.padEnd(12)}${'类型'.padEnd(8)}${'影响'.padEnd(10)}${'标题'}${COLORS.reset}`);
  console.log('-'.repeat(100));

  if (news.length === 0) {
    console.log(`${COLORS.yellow}暂无新闻${COLORS.reset}`);
  } else {
    news.forEach(item => {
      const timeStr = new Date(item.time).toLocaleTimeString('zh-CN');
      let typeStr, typeColor;
      if (item.type === 'positive') {
        typeStr = '利好';
        typeColor = COLORS.red;
      } else if (item.type === 'negative') {
        typeStr = '利空';
        typeColor = COLORS.green;
      } else {
        typeStr = '中性';
        typeColor = COLORS.yellow;
      }

      const impactStr = item.impactPercent !== 0
        ? `${item.impactPercent > 0 ? '+' : ''}${item.impactPercent}%`
        : '--';
      const impactColor = item.impactPercent > 0 ? COLORS.red : item.impactPercent < 0 ? COLORS.green : COLORS.reset;

      const targetStr = item.target.type === 'sector' ? `[板块]` : `[个股]`;

      console.log(
        `${timeStr.padEnd(12)}` +
        `${typeColor}${typeStr.padEnd(8)}${COLORS.reset}` +
        `${impactColor}${impactStr.padEnd(10)}${COLORS.reset}` +
        `${targetStr} ${item.title}`
      );
    });
  }

  console.log('='.repeat(100));
  const status = newsManager && newsManager.isEnabled ? `${COLORS.green}运行中${COLORS.reset}` : `${COLORS.red}已关闭${COLORS.reset}`;
  console.log(`新闻模拟状态: ${status} | 每30秒生成一条新闻`);
  console.log(`${COLORS.cyan}💡 news --off 关闭新闻 | news --on 开启新闻${COLORS.reset}`);
  console.log();
}

module.exports = {
  renderWatch,
  renderQuote,
  renderTop,
  renderWatchList,
  renderWatchListFavorites,
  renderWatchlistStatic,
  renderSectorOverview,
  renderSectorDetail,
  renderScreenTemplates,
  renderScreenResult,
  renderNewsList,
  colorPrice,
  colorChange,
  formatVolume,
  formatMoney,
  COLORS
};
