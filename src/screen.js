const market = require('./market');
const indicators = require('./indicators');
const { getStockList } = require('./stocks');

const SCREEN_TEMPLATES = {
  volume_breakout: {
    name: '放量突破',
    description: '成交量突破均量2倍且股价突破近期高点，强势上涨信号',
    conditions: [
      { field: 'changePercent', operator: '>', value: 3 },
      { field: 'volumeRatio', operator: '>', value: 2 },
      { field: 'pricePosition', operator: '>', value: 0.9 }
    ]
  },
  oversold_rebound: {
    name: '超跌反弹',
    description: 'RSI低于30进入超卖区，跌幅超过10%，可能出现反弹',
    conditions: [
      { field: 'changePercent', operator: '<', value: -5 },
      { field: 'RSI', operator: '<', value: 30 },
      { field: 'priceFromHigh', operator: '<', value: -10 }
    ]
  },
  ma_bullish: {
    name: '均线多头',
    description: 'MA5>MA10>MA20，均线多头排列，上升趋势确立',
    conditions: [
      { field: 'MA5', operator: '>', field2: 'MA10' },
      { field: 'MA10', operator: '>', field2: 'MA20' },
      { field: 'changePercent', operator: '>', value: 0 }
    ]
  },
  volume_pullback: {
    name: '缩量回调',
    description: '股价小幅回调但成交量萎缩，洗盘后可能继续上涨',
    conditions: [
      { field: 'changePercent', operator: '>', value: -3 },
      { field: 'changePercent', operator: '<', value: 1 },
      { field: 'volumeRatio', operator: '<', value: 0.6 },
      { field: 'MA5', operator: '>', field2: 'MA20' }
    ]
  },
  macd_golden: {
    name: 'MACD金叉',
    description: 'MACD线上穿Signal线，形成金叉买入信号',
    conditions: [
      { field: 'MACD_Cross', operator: '==', value: 1 },
      { field: 'MACD_Histogram', operator: '>', value: 0 },
      { field: 'changePercent', operator: '>', value: 0 }
    ]
  }
};

class StockScreener {
  constructor() {
    this.priceHistoryCache = new Map();
  }

  _getAverageVolume(history, periods = 20) {
    if (!history || history.length === 0) return 0;
    const recent = history.slice(-periods);
    const volumes = recent.map(h => h.volume || 0);
    return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }

  _calculateStockMetrics(stock) {
    const priceHistory = market.getPriceHistory(stock.code, 10 * 60 * 1000);
    const closes = priceHistory.map(h => h.price);

    const ind = indicators.calculateAllIndicators(priceHistory.map(h => ({ close: h.price, volume: h.volume })));
    const latest = indicators.getLatestIndicators(priceHistory.map(h => ({ close: h.price, volume: h.volume })));

    const avgVolume = this._getAverageVolume(priceHistory, 20);
    const currentVolume = stock.volume || 0;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    const highs = closes.slice(-20);
    const recentHigh = highs.length > 0 ? Math.max(...highs) : stock.currentPrice;
    const recentLow = highs.length > 0 ? Math.min(...highs) : stock.currentPrice;
    const pricePosition = recentHigh !== recentLow
      ? (stock.currentPrice - recentLow) / (recentHigh - recentLow)
      : 0.5;

    const allTimeHigh = closes.length > 0 ? Math.max(...closes) : stock.currentPrice;
    const priceFromHigh = allTimeHigh > 0
      ? ((stock.currentPrice - allTimeHigh) / allTimeHigh) * 100
      : 0;

    let macdCross = 0;
    if (ind && ind.MACD && ind.MACD.macdLine.length >= 2) {
      const len = ind.MACD.macdLine.length;
      const prevMacd = ind.MACD.macdLine[len - 2];
      const currMacd = ind.MACD.macdLine[len - 1];
      const prevSignal = ind.MACD.signalLine[len - 2];
      const currSignal = ind.MACD.signalLine[len - 1];

      if (prevMacd !== null && currMacd !== null && prevSignal !== null && currSignal !== null) {
        if (prevMacd <= prevSignal && currMacd > currSignal) {
          macdCross = 1;
        } else if (prevMacd >= prevSignal && currMacd < currSignal) {
          macdCross = -1;
        }
      }
    }

    return {
      ...stock,
      volumeRatio: parseFloat(volumeRatio.toFixed(2)),
      avgVolume: Math.round(avgVolume),
      pricePosition: parseFloat(pricePosition.toFixed(2)),
      priceFromHigh: parseFloat(priceFromHigh.toFixed(2)),
      MACD_Cross: macdCross,
      MA5: latest ? latest.MA5 : null,
      MA10: latest ? latest.MA10 : null,
      MA20: latest ? latest.MA20 : null,
      RSI: latest ? latest.RSI : null,
      MACD: latest ? latest.MACD : null,
      MACD_Signal: latest ? latest.MACD_Signal : null,
      MACD_Histogram: latest ? latest.MACD_Histogram : null,
      BB_Upper: latest ? latest.BB_Upper : null,
      BB_Middle: latest ? latest.BB_Middle : null,
      BB_Lower: latest ? latest.BB_Lower : null
    };
  }

  _evaluateCondition(stock, condition) {
    const value1 = stock[condition.field];

    if (value1 === null || value1 === undefined) {
      return false;
    }

    let value2;
    if (condition.field2 !== undefined) {
      value2 = stock[condition.field2];
      if (value2 === null || value2 === undefined) {
        return false;
      }
    } else {
      value2 = condition.value;
    }

    switch (condition.operator) {
      case '>':
        return value1 > value2;
      case '<':
        return value1 < value2;
      case '>=':
        return value1 >= value2;
      case '<=':
        return value1 <= value2;
      case '==':
        return value1 === value2;
      case '!=':
        return value1 !== value2;
      default:
        return false;
    }
  }

  parseExpression(expression) {
    if (!expression || typeof expression !== 'string') {
      return null;
    }

    const fieldMap = {
      '涨幅': 'changePercent',
      '涨跌': 'changePercent',
      '价格': 'currentPrice',
      '现价': 'currentPrice',
      '成交量': 'volumeRatio',
      '量比': 'volumeRatio',
      'RSI': 'RSI',
      'MACD': 'MACD',
      'MA5': 'MA5',
      'MA10': 'MA10',
      'MA20': 'MA20',
      '均量': 'avgVolume'
    };

    const operatorMap = {
      '>=': '>=',
      '<=': '<=',
      '>': '>',
      '<': '<',
      '==': '==',
      '!=': '!='
    };

    try {
      const parts = expression.split(/\s+(AND|OR)\s+/i);
      const conditions = [];
      const logic = [];

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;

        if (part.toUpperCase() === 'AND' || part.toUpperCase() === 'OR') {
          logic.push(part.toUpperCase());
          continue;
        }

        let matched = false;
        for (const op of ['>=', '<=', '>', '<', '==', '!=']) {
          if (part.includes(op)) {
            const [fieldPart, valuePart] = part.split(op);
            let field = fieldPart.trim();
            let valueStr = valuePart.trim();

            field = fieldMap[field] || field;

            let value;
            if (valueStr.includes('倍')) {
              value = parseFloat(valueStr);
            } else if (valueStr.includes('%')) {
              value = parseFloat(valueStr);
            } else {
              value = parseFloat(valueStr);
            }

            if (!isNaN(value)) {
              conditions.push({ field, operator: op, value });
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          console.log(`无法解析条件: ${part}`);
        }
      }

      return { conditions, logic: logic.length > 0 ? logic : ['AND'] };
    } catch (e) {
      console.log(`表达式解析错误: ${e.message}`);
      return null;
    }
  }

  runScreen(templateId) {
    const template = SCREEN_TEMPLATES[templateId];
    if (!template) {
      return { success: false, message: `选股模板不存在: ${templateId}` };
    }

    const snapshot = market.getSnapshot();
    const results = [];

    snapshot.forEach(stock => {
      const metrics = this._calculateStockMetrics(stock);
      let pass = true;

      for (const condition of template.conditions) {
        if (!this._evaluateCondition(metrics, condition)) {
          pass = false;
          break;
        }
      }

      if (pass) {
        results.push(metrics);
      }
    });

    return {
      success: true,
      template: template.name,
      description: template.description,
      count: results.length,
      stocks: results.sort((a, b) => b.changePercent - a.changePercent)
    };
  }

  runCustomScreen(expression) {
    const parsed = this.parseExpression(expression);
    if (!parsed || parsed.conditions.length === 0) {
      return { success: false, message: '条件表达式解析失败' };
    }

    const snapshot = market.getSnapshot();
    const results = [];

    snapshot.forEach(stock => {
      const metrics = this._calculateStockMetrics(stock);
      let pass;

      if (parsed.logic[0] === 'OR') {
        pass = false;
        for (const condition of parsed.conditions) {
          if (this._evaluateCondition(metrics, condition)) {
            pass = true;
            break;
          }
        }
      } else {
        pass = true;
        for (const condition of parsed.conditions) {
          if (!this._evaluateCondition(metrics, condition)) {
            pass = false;
            break;
          }
        }
      }

      if (pass) {
        results.push(metrics);
      }
    });

    return {
      success: true,
      expression,
      count: results.length,
      stocks: results.sort((a, b) => b.changePercent - a.changePercent)
    };
  }

  getTemplates() {
    return Object.entries(SCREEN_TEMPLATES).map(([id, tpl]) => ({
      id,
      name: tpl.name,
      description: tpl.description,
      conditions: tpl.conditions
    }));
  }
}

const stockScreener = new StockScreener();
module.exports = stockScreener;
