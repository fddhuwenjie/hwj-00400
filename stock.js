#!/usr/bin/env node

const market = require('./src/market');
const trading = require('./src/trading');
const watchlist = require('./src/watchlist');
const TradeHistory = require('./src/history');
const StrategyEngine = require('./src/strategy');
const ReportGenerator = require('./src/report');
const klineGenerator = require('./src/kline');
const indicators = require('./src/indicators');
const chart = require('./src/chart');
const sectorAnalyzer = require('./src/sector');
const stockScreener = require('./src/screen');
const newsManager = require('./src/news');
const { 
  renderWatchList, 
  renderWatchListFavorites,
  renderWatchlistStatic,
  renderQuote, 
  renderTop,
  renderSectorOverview,
  renderSectorDetail,
  renderScreenTemplates,
  renderScreenResult,
  renderNewsList,
  colorPrice, 
  colorChange, 
  formatVolume, 
  COLORS 
} = require('./src/display');
const { getStockByCode, getSectors, SECTORS } = require('./src/stocks');

const tradeHistory = new TradeHistory(trading);
const strategyEngine = new StrategyEngine(market, trading);

function printHelp() {
  console.log(`
${COLORS.bold}📈 股票行情模拟与交易系统${COLORS.reset}
${'='.repeat(60)}
用法: node stock.js <command> [options]

${COLORS.cyan}命令列表:${COLORS.reset}

  ${COLORS.yellow}行情展示${COLORS.reset}
    watch [--favorites]       实时监控股票列表（每秒刷新）
                                --favorites 只监控自选股
    quote <code>              查看个股详情
    top [gain|loss|volume]    显示排行榜（涨幅/跌幅/成交量）

  ${COLORS.yellow}自选股管理${COLORS.reset}
    watchlist add <code>      添加股票到自选列表
    watchlist remove <code>   从自选列表移除股票
    watchlist list            显示自选股实时行情

  ${COLORS.yellow}模拟交易${COLORS.reset}
    buy <code> <quantity> [market|limit] [price] [--tp price] [--sl price]
                              买入股票（默认市价单）
                                --tp 止盈价  --sl 止损价
    sell <code> <quantity> [market|limit] [price] [--tp price] [--sl price]
                              卖出股票（默认市价单）
    portfolio                 查看持仓和委托单（含止盈止损状态）
    alert                     查看止盈止损触发记录
    reset                     重置账户（清空所有数据）

  ${COLORS.yellow}账户报表${COLORS.reset}
    report [--export]         生成投资报表
                                --export 导出为HTML格式

  ${COLORS.yellow}技术指标${COLORS.reset}
    indicators <code>         显示技术指标（MA/RSI/MACD/布林带）

  ${COLORS.yellow}交易记录${COLORS.reset}
    history [options]         查看交易历史
      --start <YYYY-MM-DD>    开始日期
      --end <YYYY-MM-DD>      结束日期
      --code <code>           股票代码
      --type <buy|sell>       交易类型
      --limit <n>             显示条数
      --export [path]         导出为CSV

  ${COLORS.yellow}交易策略${COLORS.reset}
    strategy list             列出可用策略
    strategy activate <id>    激活策略
    strategy deactivate <id>  停用策略
    strategy backtest <id>    策略回测

  ${COLORS.yellow}板块分析${COLORS.reset}
    sector                    显示板块行情（加权涨跌幅排名）
    sector detail <板块名>    显示板块详情和个股列表
                                板块: 白酒/银行/科技/医药/新能源

  ${COLORS.yellow}条件选股${COLORS.reset}
    screen list               显示选股策略模板列表
    screen run <模板名>       执行选股模板并输出结果
                                模板: volume_breakout(放量突破)
                                      oversold_rebound(超跌反弹)
                                      ma_bullish(均线多头)
                                      volume_pullback(缩量回调)
                                      macd_golden(MACD金叉)
    screen <条件表达式>       自定义条件选股
                                如: screen "涨幅>3% AND 成交量>2倍 AND RSI<70"

  ${COLORS.yellow}新闻事件${COLORS.reset}
    news list                 显示最近20条市场新闻
    news --on                 开启新闻事件模拟（默认开启）
    news --off                关闭新闻事件模拟

${COLORS.cyan}示例:${COLORS.reset}
  node stock.js watch
  node stock.js watch --favorites
  node stock.js watchlist add 600519
  node stock.js watchlist list
  node stock.js quote 600519
  node stock.js top gain
  node stock.js buy 600519 100 --tp 2000.00 --sl 1600.00
  node stock.js sell 600519 100 limit 1800.00
  node stock.js portfolio
  node stock.js alert
  node stock.js report
  node stock.js report --export
  node stock.js history --limit 10 --export
  node stock.js indicators 000858
  node stock.js strategy backtest ma_crossover
  node stock.js sector
  node stock.js sector detail 白酒
  node stock.js screen list
  node stock.js screen run ma_bullish
  node stock.js screen "涨幅>3% AND 成交量>2倍 AND RSI<70"
  node stock.js news list
  node stock.js news --off
  node stock.js reset

${COLORS.yellow}提示:${COLORS.reset} 启动后自动开始行情模拟，按 Ctrl+C 退出
  ${COLORS.yellow}💾 数据自动保存:${COLORS.reset} 交易记录和持仓自动保存到 data/ 目录，重启后自动恢复
  ${COLORS.yellow}📰 新闻模拟:${COLORS.reset} 每30秒随机生成利好/利空/中性新闻，影响相关股票价格波动
`);
}

function parseArgs(args) {
  const command = args[2];
  const options = {};
  let positional = [];
  
  for (let i = 3; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[key] = args[i + 1];
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  
  return { command, positional, options };
}

async function executeCommand(cmd, positional, options) {
  market.start();
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  switch (cmd) {
    case 'watch':
      runWatchMode(options);
      break;
      
    case 'watchlist':
      handleWatchlist(positional);
      break;
      
    case 'quote':
      if (positional.length < 1) {
        console.log(`${COLORS.red}错误: 请指定股票代码${COLORS.reset}`);
        process.exit(1);
      }
      runQuoteMode(positional[0]);
      break;
      
    case 'top':
      const type = positional[0] || 'gain';
      const count = parseInt(options.count) || 5;
      runTopMode(type, count);
      break;
      
    case 'buy':
    case 'sell':
      if (positional.length < 2) {
        console.log(`${COLORS.red}错误: 请指定股票代码和数量${COLORS.reset}`);
        process.exit(1);
      }
      handleTrade(cmd, positional[0], parseInt(positional[1]), positional[2], parseFloat(positional[3]), options);
      break;
      
    case 'portfolio':
      trading.renderPortfolio();
      process.exit(0);
      break;
      
    case 'alert':
      trading.renderAlerts();
      process.exit(0);
      break;
      
    case 'report':
      const reportGen = new ReportGenerator(trading, tradeHistory);
      if (options.export) {
        reportGen.exportHTML();
      } else {
        reportGen.renderReport();
      }
      process.exit(0);
      break;
      
    case 'reset':
      trading.reset();
      watchlist.reset();
      process.exit(0);
      break;
      
    case 'indicators':
      if (positional.length < 1) {
        console.log(`${COLORS.red}错误: 请指定股票代码${COLORS.reset}`);
        process.exit(1);
      }
      showIndicators(positional[0]);
      break;
      
    case 'history':
      showHistory(options);
      break;
      
    case 'strategy':
      handleStrategy(positional, options);
      break;
      
    case 'sector':
      handleSector(positional, options);
      break;
      
    case 'screen':
      handleScreen(positional, options);
      break;
      
    case 'news':
      handleNews(positional, options);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      process.exit(0);
      break;
      
    default:
      console.log(`${COLORS.red}未知命令: ${cmd}${COLORS.reset}`);
      printHelp();
      process.exit(1);
  }
}

function runWatchMode(options = {}) {
  const renderFn = options.favorites ? renderWatchListFavorites : renderWatchList;
  
  renderFn();
  klineGenerator.update();
  
  const intervalId = setInterval(() => {
    renderFn();
    klineGenerator.update();
  }, 1000);
  
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    market.stop();
    console.log('\n👋 再见！');
    process.exit(0);
  });
}

function handleWatchlist(positional) {
  const action = positional[0];
  const code = positional[1];
  
  switch (action) {
    case 'add':
      if (!code) {
        console.log(`${COLORS.red}错误: 请指定股票代码${COLORS.reset}`);
        process.exit(1);
      }
      const addResult = watchlist.add(code);
      if (addResult.success) {
        console.log(`${COLORS.green}✅ ${addResult.message}${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}❌ ${addResult.message}${COLORS.reset}`);
      }
      break;
      
    case 'remove':
      if (!code) {
        console.log(`${COLORS.red}错误: 请指定股票代码${COLORS.reset}`);
        process.exit(1);
      }
      const removeResult = watchlist.remove(code);
      if (removeResult.success) {
        console.log(`${COLORS.green}✅ ${removeResult.message}${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}❌ ${removeResult.message}${COLORS.reset}`);
      }
      break;
      
    case 'list':
      renderWatchlistStatic();
      break;
      
    default:
      console.log(`${COLORS.red}未知操作: ${action}${COLORS.reset}`);
      console.log('可用操作: add <code>, remove <code>, list');
  }
  
  process.exit(0);
}

function runQuoteMode(code) {
  klineGenerator.update();
  renderQuote(code);
  
  const intervalId = setInterval(() => {
    klineGenerator.update();
    renderQuote(code);
  }, 1000);
  
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    market.stop();
    console.log('\n👋 再见！');
    process.exit(0);
  });
}

function runTopMode(type, count) {
  renderTop(type, count);
  process.exit(0);
}

function handleTrade(action, code, quantity, orderType, price, options = {}) {
  const stock = getStockByCode(code);
  if (!stock) {
    console.log(`${COLORS.red}错误: 股票代码不存在: ${code}${COLORS.reset}`);
    process.exit(1);
  }
  
  if (isNaN(quantity) || quantity <= 0 || quantity % 100 !== 0) {
    console.log(`${COLORS.red}错误: 数量必须为100的正整数倍${COLORS.reset}`);
    process.exit(1);
  }
  
  const type = orderType || 'market';
  if (type !== 'market' && type !== 'limit') {
    console.log(`${COLORS.red}错误: 订单类型必须是 market 或 limit${COLORS.reset}`);
    process.exit(1);
  }
  
  if (type === 'limit' && (isNaN(price) || price <= 0)) {
    console.log(`${COLORS.red}错误: 限价单必须指定有效价格${COLORS.reset}`);
    process.exit(1);
  }
  
  const takeProfit = options.tp ? parseFloat(options.tp) : null;
  const stopLoss = options.sl ? parseFloat(options.sl) : null;
  
  if (takeProfit !== null && isNaN(takeProfit)) {
    console.log(`${COLORS.red}错误: 止盈价无效${COLORS.reset}`);
    process.exit(1);
  }
  
  if (stopLoss !== null && isNaN(stopLoss)) {
    console.log(`${COLORS.red}错误: 止损价无效${COLORS.reset}`);
    process.exit(1);
  }
  
  let result;
  if (action === 'buy') {
    result = trading.buy(code, quantity, type, price, takeProfit, stopLoss);
  } else {
    result = trading.sell(code, quantity, type, price);
  }
  
  if (result.success) {
    console.log(`${COLORS.green}✅ ${result.message}${COLORS.reset}`);
    if (takeProfit !== null || stopLoss !== null) {
      let extra = [];
      if (takeProfit !== null) extra.push(`止盈价: ${takeProfit.toFixed(2)}`);
      if (stopLoss !== null) extra.push(`止损价: ${stopLoss.toFixed(2)}`);
      console.log(`${COLORS.cyan}📌 ${extra.join(', ')}${COLORS.reset}`);
    }
    trading.renderPortfolio();
  } else {
    console.log(`${COLORS.red}❌ ${result.message}${COLORS.reset}`);
  }
  
  process.exit(result.success ? 0 : 1);
}

function showIndicators(code) {
  const stock = market.getStock(code);
  if (!stock) {
    console.log(`${COLORS.red}错误: 未找到股票代码 ${code}${COLORS.reset}`);
    process.exit(1);
  }
  
  const stockInfo = getStockByCode(code);
  klineGenerator.update();
  
  const priceHistory = market.getPriceHistory(code);
  const klineData = klineGenerator.getKline(code, '1min', 100);
  
  let priceData;
  if (klineData.length >= 30) {
    priceData = klineData;
  } else {
    priceData = priceHistory.map(h => ({ close: h.price, volume: h.volume }));
  }
  
  const ind = indicators.calculateAllIndicators(priceData);
  const latestInd = indicators.getLatestIndicators(priceData);
  
  console.clear();
  console.log(`${COLORS.bold}📊 ${stockInfo.name} (${stock.code}) - 技术指标分析${COLORS.reset}`);
  console.log('='.repeat(80));
  console.log(`现价: ${colorPrice(stock.currentPrice, stock.prevClose)}    涨跌: ${colorChange(stock.change, stock.changePercent)}`);
  console.log('='.repeat(80));
  
  if (latestInd) {
    console.log();
    console.log(`${COLORS.cyan}📈 移动均线 (Moving Averages)${COLORS.reset}`);
    console.log('-'.repeat(60));
    console.log(`MA5:  ${latestInd.MA5 ? latestInd.MA5.toFixed(2) : '--'}    ${latestInd.MA5 && latestInd.MA5 > stock.currentPrice ? '⬇' : latestInd.MA5 && latestInd.MA5 < stock.currentPrice ? '⬆' : '→'}`);
    console.log(`MA10: ${latestInd.MA10 ? latestInd.MA10.toFixed(2) : '--'}    ${latestInd.MA10 && latestInd.MA10 > stock.currentPrice ? '⬇' : latestInd.MA10 && latestInd.MA10 < stock.currentPrice ? '⬆' : '→'}`);
    console.log(`MA20: ${latestInd.MA20 ? latestInd.MA20.toFixed(2) : '--'}    ${latestInd.MA20 && latestInd.MA20 > stock.currentPrice ? '⬇' : latestInd.MA20 && latestInd.MA20 < stock.currentPrice ? '⬆' : '→'}`);
    
    console.log();
    console.log(`${COLORS.cyan}💪 RSI 相对强弱指标${COLORS.reset}`);
    console.log('-'.repeat(60));
    const rsi = latestInd.RSI;
    let rsiStatus = '中性';
    let rsiColor = COLORS.reset;
    if (rsi) {
      if (rsi > 70) {
        rsiStatus = '超买 (考虑卖出)';
        rsiColor = COLORS.red;
      } else if (rsi < 30) {
        rsiStatus = '超卖 (考虑买入)';
        rsiColor = COLORS.green;
      }
    }
    console.log(`RSI14: ${rsi ? rsi.toFixed(2) : '--'}    ${rsiColor}${rsiStatus}${COLORS.reset}`);
    
    console.log();
    console.log(`${COLORS.cyan}📊 MACD 指标${COLORS.reset}`);
    console.log('-'.repeat(60));
    console.log(`MACD:     ${latestInd.MACD ? latestInd.MACD.toFixed(3) : '--'}`);
    console.log(`Signal:   ${latestInd.MACD_Signal ? latestInd.MACD_Signal.toFixed(3) : '--'}`);
    const hist = latestInd.MACD_Histogram;
    let macdStatus = '中性';
    let macdColor = COLORS.reset;
    if (hist !== null && hist !== undefined) {
      if (hist > 0) {
        macdStatus = '多头排列';
        macdColor = COLORS.red;
      } else if (hist < 0) {
        macdStatus = '空头排列';
        macdColor = COLORS.green;
      }
    }
    console.log(`Histogram:${hist !== null && hist !== undefined ? hist.toFixed(3) : '--'}    ${macdColor}${macdStatus}${COLORS.reset}`);
    
    console.log();
    console.log(`${COLORS.cyan}🔮 布林带 (Bollinger Bands)${COLORS.reset}`);
    console.log('-'.repeat(60));
    console.log(`上轨: ${latestInd.BB_Upper ? latestInd.BB_Upper.toFixed(2) : '--'}`);
    console.log(`中轨: ${latestInd.BB_Middle ? latestInd.BB_Middle.toFixed(2) : '--'}`);
    console.log(`下轨: ${latestInd.BB_Lower ? latestInd.BB_Lower.toFixed(2) : '--'}`);
    
    let bbStatus = '正常区间';
    let bbColor = COLORS.reset;
    if (latestInd.BB_Upper && latestInd.BB_Lower) {
      if (stock.currentPrice > latestInd.BB_Upper) {
        bbStatus = '突破上轨 (超买)';
        bbColor = COLORS.red;
      } else if (stock.currentPrice < latestInd.BB_Lower) {
        bbStatus = '跌破下轨 (超卖)';
        bbColor = COLORS.green;
      }
    }
    console.log(`当前价格位置: ${bbColor}${bbStatus}${COLORS.reset}`);
  }
  
  console.log();
  console.log(chart.renderPriceChart(priceData, ind, '📈 价格走势 + 技术指标'));
  console.log();
  console.log(chart.renderVolumeChart(priceData, 5));
  if (ind && ind.RSI) {
    console.log();
    console.log(chart.renderRSIChart(ind.RSI, 5));
  }
  
  process.exit(0);
}

function showHistory(options) {
  const result = tradeHistory.renderHistory(options);
  
  if (options.export) {
    const filePath = typeof options.export === 'string' ? options.export : undefined;
    tradeHistory.exportCSV({ ...options, file: filePath });
  }
  
  process.exit(0);
}

function handleStrategy(positional, options) {
  const action = positional[0];
  
  switch (action) {
    case 'list':
      strategyEngine.renderStrategies();
      break;
      
    case 'activate':
      if (positional.length < 2) {
        console.log(`${COLORS.red}错误: 请指定策略ID${COLORS.reset}`);
        process.exit(1);
      }
      const activateResult = strategyEngine.activateStrategy(positional[1]);
      if (activateResult.success) {
        console.log(`${COLORS.green}✅ ${activateResult.message}${COLORS.reset}`);
        console.log(`配置: ${JSON.stringify(activateResult.config)}`);
      } else {
        console.log(`${COLORS.red}❌ ${activateResult.message}${COLORS.reset}`);
      }
      break;
      
    case 'deactivate':
      if (positional.length < 2) {
        console.log(`${COLORS.red}错误: 请指定策略ID${COLORS.reset}`);
        process.exit(1);
      }
      const deactivateResult = strategyEngine.deactivateStrategy(positional[1]);
      if (deactivateResult.success) {
        console.log(`${COLORS.green}✅ ${deactivateResult.message}${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}❌ ${deactivateResult.message}${COLORS.reset}`);
      }
      break;
      
    case 'backtest':
      if (positional.length < 2) {
        console.log(`${COLORS.red}错误: 请指定策略ID${COLORS.reset}`);
        process.exit(1);
      }
      console.log(`${COLORS.yellow}⏳ 正在生成历史数据并执行回测...${COLORS.reset}`);
      const historicalData = market.generateHistoricalData(60);
      const backtestResult = strategyEngine.runBacktest(positional[1], historicalData);
      if (backtestResult.success) {
        strategyEngine.renderBacktestResult(backtestResult);
      } else {
        console.log(`${COLORS.red}❌ ${backtestResult.message}${COLORS.reset}`);
      }
      break;
      
    default:
      console.log(`${COLORS.red}未知策略操作: ${action}${COLORS.reset}`);
      console.log('可用操作: list, activate, deactivate, backtest');
  }
  
  process.exit(0);
}

function handleSector(positional, options) {
  const action = positional[0];
  const sectorName = positional[1];

  if (!action || action === 'list') {
    const overview = sectorAnalyzer.getSectorOverview();
    renderSectorOverview(overview);
    process.exit(0);
    return;
  }

  if (action === 'detail') {
    if (!sectorName) {
      console.log(`${COLORS.red}错误: 请指定板块名称${COLORS.reset}`);
      console.log(`可用板块: ${SECTORS.join(' / ')}`);
      process.exit(1);
    }
    if (!SECTORS.includes(sectorName)) {
      console.log(`${COLORS.red}错误: 未知板块 "${sectorName}"${COLORS.reset}`);
      console.log(`可用板块: ${SECTORS.join(' / ')}`);
      process.exit(1);
    }
    const detail = sectorAnalyzer.getSectorDetail(sectorName);
    if (detail) {
      renderSectorDetail(detail);
    } else {
      console.log(`${COLORS.red}错误: 无法获取板块数据${COLORS.reset}`);
    }
    process.exit(0);
    return;
  }

  console.log(`${COLORS.red}未知板块操作: ${action}${COLORS.reset}`);
  console.log('可用操作: list, detail <板块名>');
  process.exit(1);
}

function handleScreen(positional, options) {
  const action = positional[0];
  const templateId = positional[1];

  if (!action || action === 'list') {
    const templates = stockScreener.getTemplates();
    renderScreenTemplates(templates);
    process.exit(0);
    return;
  }

  if (action === 'run') {
    if (!templateId) {
      console.log(`${COLORS.red}错误: 请指定选股模板ID${COLORS.reset}`);
      console.log('可用模板: volume_breakout, oversold_rebound, ma_bullish, volume_pullback, macd_golden');
      process.exit(1);
    }
    const result = stockScreener.runScreen(templateId);
    if (result.success) {
      renderScreenResult(result);
    } else {
      console.log(`${COLORS.red}❌ ${result.message}${COLORS.reset}`);
    }
    process.exit(0);
    return;
  }

  if (action && !['list', 'run'].includes(action)) {
    const expression = positional.join(' ');
    const result = stockScreener.runCustomScreen(expression);
    if (result.success) {
      renderScreenResult(result);
    } else {
      console.log(`${COLORS.red}❌ ${result.message}${COLORS.reset}`);
    }
    process.exit(0);
    return;
  }

  console.log(`${COLORS.red}未知选股操作${COLORS.reset}`);
  console.log('可用操作: list, run <模板ID>, <条件表达式>');
  process.exit(1);
}

function handleNews(positional, options) {
  const action = positional[0];

  if (options.off !== undefined) {
    newsManager.disable();
    process.exit(0);
    return;
  }

  if (options.on !== undefined) {
    newsManager.enable();
    process.exit(0);
    return;
  }

  if (!action || action === 'list') {
    const news = newsManager.getRecentNews(20);
    renderNewsList(news);
    process.exit(0);
    return;
  }

  console.log(`${COLORS.red}未知新闻操作: ${action}${COLORS.reset}`);
  console.log('可用操作: list, --on, --off');
  process.exit(1);
}

async function main() {
  const args = process.argv;
  
  if (args.length < 3) {
    printHelp();
    process.exit(1);
  }
  
  const { command, positional, options } = parseArgs(args);
  await executeCommand(command, positional, options);
}

main().catch(err => {
  console.error(`${COLORS.red}错误: ${err.message}${COLORS.reset}`);
  console.error(err.stack);
  process.exit(1);
});
