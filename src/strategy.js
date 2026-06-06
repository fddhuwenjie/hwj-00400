const { SMA, EMA, RSI, MACD, BollingerBands } = require('./indicators');
const { COLORS, colorChange } = require('./display');

const STRATEGIES = {
  ma_crossover: {
    name: 'MA均线交叉策略',
    description: 'MA5上穿MA10买入，MA5下穿MA10卖出',
    params: {
      fastPeriod: 5,
      slowPeriod: 10
    }
  },
  rsi: {
    name: 'RSI超买超卖策略',
    description: 'RSI低于30买入，高于70卖出',
    params: {
      period: 14,
      oversold: 30,
      overbought: 70
    }
  },
  bollinger: {
    name: '布林带突破策略',
    description: '价格跌破下轨买入，突破上轨卖出',
    params: {
      period: 20,
      stdDev: 2
    }
  },
  macd: {
    name: 'MACD金叉死叉策略',
    description: 'MACD金叉买入，死叉卖出',
    params: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    }
  }
};

class StrategyEngine {
  constructor(market, trading) {
    this.market = market;
    this.trading = trading;
    this.activeStrategies = new Map();
    this.isRunning = false;
    this.backtestResults = null;
  }

  getAvailableStrategies() {
    return Object.entries(STRATEGIES).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  activateStrategy(strategyId, params = {}) {
    const strategy = STRATEGIES[strategyId];
    if (!strategy) {
      return { success: false, message: `策略不存在: ${strategyId}` };
    }
    
    const config = {
      ...strategy.params,
      ...params
    };
    
    this.activeStrategies.set(strategyId, {
      ...strategy,
      config,
      signals: []
    });
    
    return {
      success: true,
      message: `策略已激活: ${strategy.name}`,
      config
    };
  }

  deactivateStrategy(strategyId) {
    if (!this.activeStrategies.has(strategyId)) {
      return { success: false, message: `策略未激活: ${strategyId}` };
    }
    
    this.activeStrategies.delete(strategyId);
    return { success: true, message: `策略已停用` };
  }

  _checkSignals(strategyId, priceData) {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) return null;
    
    const closes = priceData.map(d => d.close || d.price);
    if (closes.length < 30) return null;
    
    let signal = null;
    
    switch (strategyId) {
      case 'ma_crossover':
        signal = this._checkMACrossover(closes, strategy.config);
        break;
      case 'rsi':
        signal = this._checkRSI(closes, strategy.config);
        break;
      case 'bollinger':
        signal = this._checkBollinger(closes, strategy.config);
        break;
      case 'macd':
        signal = this._checkMACD(closes, strategy.config);
        break;
    }
    
    if (signal) {
      strategy.signals.push({
        time: Date.now(),
        ...signal
      });
    }
    
    return signal;
  }

  _checkMACrossover(closes, config) {
    const fastMA = SMA(closes, config.fastPeriod);
    const slowMA = SMA(closes, config.slowPeriod);
    
    const len = closes.length;
    if (len < config.slowPeriod + 2) return null;
    
    const fastPrev = fastMA[len - 2];
    const fastCurr = fastMA[len - 1];
    const slowPrev = slowMA[len - 2];
    const slowCurr = slowMA[len - 1];
    
    if (fastPrev === null || fastCurr === null || slowPrev === null || slowCurr === null) {
      return null;
    }
    
    if (fastPrev <= slowPrev && fastCurr > slowCurr) {
      return { type: 'buy', price: closes[len - 1], reason: `MA${config.fastPeriod}(${fastCurr.toFixed(2)})上穿MA${config.slowPeriod}(${slowCurr.toFixed(2)})` };
    }
    
    if (fastPrev >= slowPrev && fastCurr < slowCurr) {
      return { type: 'sell', price: closes[len - 1], reason: `MA${config.fastPeriod}(${fastCurr.toFixed(2)})下穿MA${config.slowPeriod}(${slowCurr.toFixed(2)})` };
    }
    
    return null;
  }

  _checkRSI(closes, config) {
    const rsi = RSI(closes, config.period);
    const len = closes.length;
    
    const rsiCurr = rsi[len - 1];
    const rsiPrev = rsi[len - 2];
    
    if (rsiCurr === null || rsiPrev === null) return null;
    
    if (rsiPrev >= config.oversold && rsiCurr < config.oversold) {
      return { type: 'buy', price: closes[len - 1], reason: `RSI(${rsiCurr.toFixed(2)})跌破${config.oversold}，超卖信号` };
    }
    
    if (rsiPrev <= config.overbought && rsiCurr > config.overbought) {
      return { type: 'sell', price: closes[len - 1], reason: `RSI(${rsiCurr.toFixed(2)})突破${config.overbought}，超买信号` };
    }
    
    return null;
  }

  _checkBollinger(closes, config) {
    const bb = BollingerBands(closes, config.period, config.stdDev);
    
    const len = closes.length;
    if (len < config.period + 1) return null;
    
    const price = closes[len - 1];
    const prevPrice = closes[len - 2];
    const lower = bb.lower[len - 1];
    const upper = bb.upper[len - 1];
    const prevLower = bb.lower[len - 2];
    const prevUpper = bb.upper[len - 2];
    
    if (lower === null || upper === null) return null;
    
    if (prevPrice >= prevLower && price < lower) {
      return { type: 'buy', price, reason: `价格(${price.toFixed(2)})跌破布林下轨(${lower.toFixed(2)})` };
    }
    
    if (prevPrice <= prevUpper && price > upper) {
      return { type: 'sell', price, reason: `价格(${price.toFixed(2)})突破布林上轨(${upper.toFixed(2)})` };
    }
    
    return null;
  }

  _checkMACD(closes, config) {
    const macd = MACD(closes, config.fastPeriod, config.slowPeriod, config.signalPeriod);
    
    const len = closes.length;
    if (len < config.slowPeriod + config.signalPeriod) return null;
    
    const macdCurr = macd.macdLine[len - 1];
    const signalCurr = macd.signalLine[len - 1];
    const macdPrev = macd.macdLine[len - 2];
    const signalPrev = macd.signalLine[len - 2];
    
    if (macdCurr === null || signalCurr === null || macdPrev === null || signalPrev === null) {
      return null;
    }
    
    if (macdPrev <= signalPrev && macdCurr > signalCurr) {
      return { type: 'buy', price: closes[len - 1], reason: `MACD(${macdCurr.toFixed(3)})金叉Signal(${signalCurr.toFixed(3)})` };
    }
    
    if (macdPrev >= signalPrev && macdCurr < signalCurr) {
      return { type: 'sell', price: closes[len - 1], reason: `MACD(${macdCurr.toFixed(3)})死叉Signal(${signalCurr.toFixed(3)})` };
    }
    
    return null;
  }

  runBacktest(strategyId, historicalData, initialCapital = 1000000) {
    const strategy = STRATEGIES[strategyId];
    if (!strategy) {
      return { success: false, message: `策略不存在: ${strategyId}` };
    }
    
    const results = [];
    
    historicalData.forEach((data, code) => {
      const result = this._backtestSingle(code, data, strategyId, strategy.params, initialCapital);
      results.push(result);
    });
    
    const overall = this._aggregateBacktestResults(results, initialCapital);
    this.backtestResults = overall;
    
    return { success: true, results, overall };
  }

  _backtestSingle(code, data, strategyId, params, initialCapital) {
    let cash = initialCapital;
    let position = 0;
    let avgCost = 0;
    const trades = [];
    const equityCurve = [];
    let maxEquity = initialCapital;
    let maxDrawdown = 0;
    
    const strategy = { config: params, signals: [] };
    this.activeStrategies.set(strategyId, strategy);
    
    for (let i = 30; i < data.length; i++) {
      const slice = data.slice(0, i + 1);
      const signal = this._checkSignals(strategyId, slice);
      const price = data[i].close;
      
      if (signal && signal.type === 'buy' && position === 0) {
        const quantity = Math.floor((cash * 0.95) / price / 100) * 100;
        if (quantity > 0) {
          const cost = quantity * price;
          const commission = Math.max(cost * 0.0003, 5);
          cash -= cost + commission;
          position = quantity;
          avgCost = price;
          trades.push({
            type: 'buy',
            time: data[i].date,
            price,
            quantity,
            reason: signal.reason
          });
        }
      }
      
      if (signal && signal.type === 'sell' && position > 0) {
        const revenue = position * price;
        const commission = Math.max(revenue * 0.0003, 5);
        const stampDuty = revenue * 0.001;
        cash += revenue - commission - stampDuty;
        const profit = revenue - commission - stampDuty - position * avgCost;
        trades.push({
          type: 'sell',
          time: data[i].date,
          price,
          quantity: position,
          profit,
          reason: signal.reason
        });
        position = 0;
        avgCost = 0;
      }
      
      const equity = cash + position * price;
      equityCurve.push({
        date: data[i].date,
        equity
      });
      
      if (equity > maxEquity) {
        maxEquity = equity;
      }
      
      const drawdown = ((maxEquity - equity) / maxEquity) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    this.activeStrategies.delete(strategyId);
    
    const finalEquity = cash + position * avgCost;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
    
    const sellTrades = trades.filter(t => t.type === 'sell');
    const winningTrades = sellTrades.filter(t => t.profit > 0);
    const winRate = sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0;
    
    return {
      code,
      initialCapital,
      finalEquity: parseFloat(finalEquity.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      trades,
      equityCurve
    };
  }

  _aggregateBacktestResults(results, initialCapital) {
    const totalInitial = initialCapital * results.length;
    const totalFinal = results.reduce((sum, r) => sum + r.finalEquity, 0);
    const totalReturn = ((totalFinal - totalInitial) / totalInitial) * 100;
    
    const maxDrawdown = Math.max(...results.map(r => r.maxDrawdown));
    const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
    const totalWinning = results.reduce((sum, r) => sum + r.winningTrades, 0);
    const winRate = totalTrades > 0 ? (totalWinning / (totalTrades / 2)) * 100 : 0;
    
    const best = results.reduce((max, r) => r.totalReturn > max.totalReturn ? r : max, results[0]);
    const worst = results.reduce((min, r) => r.totalReturn < min.totalReturn ? r : min, results[0]);
    
    return {
      totalInitial: parseFloat(totalInitial.toFixed(2)),
      totalFinal: parseFloat(totalFinal.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      totalTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      best,
      worst,
      results
    };
  }

  renderStrategies() {
    const strategies = this.getAvailableStrategies();
    
    console.log();
    console.log(`${COLORS.bold}🤖 可用策略${COLORS.reset}`);
    console.log('='.repeat(80));
    
    strategies.forEach(strategy => {
      const isActive = this.activeStrategies.has(strategy.id);
      const status = isActive ? `${COLORS.green}[运行中]${COLORS.reset}` : `${COLORS.gray}[已停止]${COLORS.reset}`;
      
      console.log();
      console.log(`${COLORS.cyan}${strategy.id}${COLORS.reset} ${status} - ${strategy.name}`);
      console.log(`  描述: ${strategy.description}`);
      console.log(`  参数: ${JSON.stringify(strategy.params)}`);
      
      if (isActive) {
        const active = this.activeStrategies.get(strategy.id);
        console.log(`  已产生 ${active.signals.length} 个信号`);
      }
    });
    
    console.log('='.repeat(80));
  }

  renderBacktestResult(result) {
    if (!result || !result.overall) {
      console.log(`${COLORS.red}暂无回测结果${COLORS.reset}`);
      return;
    }
    
    const overall = result.overall;
    
    console.log();
    console.log(`${COLORS.bold}📊 策略回测结果${COLORS.reset}`);
    console.log('='.repeat(80));
    console.log(`初始资金: ${overall.totalInitial.toFixed(2)}`);
    console.log(`最终资金: ${overall.totalFinal.toFixed(2)}`);
    console.log(`总收益率: ${colorChange(overall.totalReturn, 0)}`);
    console.log(`最大回撤: ${COLORS.red}${overall.maxDrawdown.toFixed(2)}%${COLORS.reset}`);
    console.log(`总交易次数: ${overall.totalTrades}`);
    console.log(`胜率: ${overall.winRate.toFixed(2)}%`);
    console.log('='.repeat(80));
    
    console.log();
    console.log(`${COLORS.cyan}📈 分股票表现${COLORS.reset}`);
    console.log('-'.repeat(80));
    
    result.results.sort((a, b) => b.totalReturn - a.totalReturn).forEach(r => {
      const returnStr = colorChange(r.totalReturn, 0);
      console.log(
        `${r.code.padEnd(10)}收益: ${returnStr.padEnd(18)}最大回撤: ${r.maxDrawdown.toFixed(2)}%${' '.padEnd(8)}交易: ${r.totalTrades.toString().padEnd(6)}胜率: ${r.winRate.toFixed(2)}%`
      );
    });
    
    console.log('='.repeat(80));
    console.log(`最佳表现: ${overall.best.code} ${colorChange(overall.best.totalReturn, 0)}`);
    console.log(`最差表现: ${overall.worst.code} ${colorChange(overall.worst.totalReturn, 0)}`);
    console.log('='.repeat(80));
  }
}

module.exports = StrategyEngine;
