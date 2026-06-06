const fs = require('fs');
const path = require('path');
const { COLORS, colorChange } = require('./display');

class TradeHistory {
  constructor(trading) {
    this.trading = trading;
  }

  getHistory(options = {}) {
    let history = this.trading.getTradeHistory();
    
    if (options.startDate) {
      const startTime = new Date(options.startDate).getTime();
      history = history.filter(h => h.time >= startTime);
    }
    
    if (options.endDate) {
      const endTime = new Date(options.endDate).getTime() + 24 * 60 * 60 * 1000;
      history = history.filter(h => h.time < endTime);
    }
    
    if (options.code) {
      history = history.filter(h => h.code === options.code);
    }
    
    if (options.type) {
      history = history.filter(h => h.type === options.type);
    }
    
    return history.sort((a, b) => b.time - a.time);
  }

  getStatistics(history = null) {
    if (!history) {
      history = this.trading.getTradeHistory();
    }
    
    const sellTrades = history.filter(h => h.type === 'sell');
    const totalTrades = sellTrades.length;
    const totalProfit = sellTrades.reduce((sum, t) => sum + t.profit, 0);
    const winningTrades = sellTrades.filter(t => t.profit > 0);
    const losingTrades = sellTrades.filter(t => t.profit < 0);
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    
    let maxProfit = 0;
    let maxLoss = 0;
    let maxProfitTrade = null;
    let maxLossTrade = null;
    
    sellTrades.forEach(t => {
      if (t.profit > maxProfit) {
        maxProfit = t.profit;
        maxProfitTrade = t;
      }
      if (t.profit < maxLoss) {
        maxLoss = t.profit;
        maxLossTrade = t;
      }
    });
    
    const avgProfit = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length 
      : 0;
    
    const profitFactor = Math.abs(avgLoss) > 0 ? (avgProfit / Math.abs(avgLoss)) : 0;
    
    return {
      totalTrades,
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      maxProfit: parseFloat(maxProfit.toFixed(2)),
      maxLoss: parseFloat(maxLoss.toFixed(2)),
      maxProfitTrade,
      maxLossTrade,
      avgProfit: parseFloat(avgProfit.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2))
    };
  }

  renderHistory(options = {}) {
    const history = this.getHistory(options);
    const stats = this.getStatistics(history);
    
    console.log();
    console.log(`${COLORS.bold}📜 交易历史${COLORS.reset}`);
    console.log('='.repeat(110));
    
    let filterStr = '';
    if (options.startDate) filterStr += ` 开始: ${options.startDate}`;
    if (options.endDate) filterStr += ` 结束: ${options.endDate}`;
    if (options.code) filterStr += ` 股票: ${options.code}`;
    if (options.type) filterStr += ` 类型: ${options.type === 'buy' ? '买入' : '卖出'}`;
    if (filterStr) {
      console.log(`${COLORS.yellow}筛选条件:${filterStr}${COLORS.reset}`);
      console.log('-'.repeat(110));
    }
    
    console.log(`${COLORS.cyan}${'时间'.padEnd(22)}${'方向'.padEnd(8)}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'数量'.padEnd(10)}${'价格'.padEnd(12)}${'金额'.padEnd(14)}${'手续费'.padEnd(10)}${'盈亏'}`);
    console.log('-'.repeat(110));
    
    if (history.length === 0) {
      console.log(`${COLORS.yellow}暂无交易记录${COLORS.reset}`);
    } else {
      const displayHistory = options.limit ? history.slice(0, options.limit) : history;
      
      displayHistory.forEach(trade => {
        const time = new Date(trade.time).toLocaleString('zh-CN');
        const typeStr = trade.type === 'buy' ? `${COLORS.red}买入${COLORS.reset}` : `${COLORS.green}卖出${COLORS.reset}`;
        const profitStr = trade.type === 'sell' ? colorChange(trade.profit, 0) : '-';
        
        console.log(
          `${time.padEnd(22)}${typeStr.padEnd(8)}${trade.code.padEnd(10)}${trade.name.padEnd(12)}${trade.quantity.toString().padEnd(10)}${trade.price.toFixed(2).padEnd(12)}${trade.amount.toFixed(2).padEnd(14)}${trade.commission.toFixed(2).padEnd(10)}${profitStr}`
        );
      });
    }
    
    console.log('='.repeat(110));
    
    console.log();
    console.log(`${COLORS.bold}📊 交易统计${COLORS.reset}`);
    console.log('='.repeat(60));
    console.log(`总交易次数: ${stats.totalTrades}`);
    console.log(`盈利次数: ${COLORS.red}${stats.winningTrades}${COLORS.reset}    亏损次数: ${COLORS.green}${stats.losingTrades}${COLORS.reset}`);
    console.log(`胜率: ${stats.winRate.toFixed(2)}%`);
    console.log(`总盈亏: ${colorChange(stats.totalProfit, 0)}`);
    console.log(`平均盈利: ${stats.avgProfit.toFixed(2)}    平均亏损: ${stats.avgLoss.toFixed(2)}`);
    console.log(`盈亏比: ${stats.profitFactor.toFixed(2)}`);
    console.log(`最大单笔盈利: ${COLORS.red}${stats.maxProfit.toFixed(2)}${COLORS.reset}${stats.maxProfitTrade ? ` (${stats.maxProfitTrade.name})` : ''}`);
    console.log(`最大单笔亏损: ${COLORS.green}${stats.maxLoss.toFixed(2)}${COLORS.reset}${stats.maxLossTrade ? ` (${stats.maxLossTrade.name})` : ''}`);
    console.log('='.repeat(60));
    
    return { history, stats };
  }

  exportCSV(options = {}) {
    const history = this.getHistory(options);
    const filePath = options.file || path.join(process.cwd(), `trade_history_${Date.now()}.csv`);
    
    const headers = ['时间', '方向', '代码', '名称', '数量', '价格', '金额', '手续费', '盈亏'];
    const rows = history.map(trade => {
      const time = new Date(trade.time).toLocaleString('zh-CN');
      const type = trade.type === 'buy' ? '买入' : '卖出';
      return [time, type, trade.code, trade.name, trade.quantity, trade.price, trade.amount, trade.commission, trade.profit || 0];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf-8');
    
    console.log();
    console.log(`${COLORS.green}✅ CSV文件已导出: ${filePath}${COLORS.reset}`);
    console.log(`共导出 ${history.length} 条交易记录`);
    
    return filePath;
  }
}

module.exports = TradeHistory;
