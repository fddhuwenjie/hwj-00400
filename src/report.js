const fs = require('fs');
const path = require('path');
const { COLORS, colorChange, formatVolume } = require('./display');

class ReportGenerator {
  constructor(trading, tradeHistory) {
    this.trading = trading;
    this.tradeHistory = tradeHistory;
  }

  generateReport() {
    const pf = this.trading.getPortfolio();
    const assetHistory = this.trading.getAssetHistory();
    const trades = this.trading.getTradeHistory();
    const alerts = this.trading.getAlerts();

    const totalReturn = this.calculateTotalReturn(pf);
    const annualizedReturn = this.calculateAnnualizedReturn(pf, assetHistory);
    const maxDrawdown = this.calculateMaxDrawdown(assetHistory);
    const sharpeRatio = this.calculateSharpeRatio(assetHistory);
    const monthlyStats = this.calculateMonthlyStats(trades);
    const assetAllocation = this.calculateAssetAllocation(pf);

    return {
      portfolio: pf,
      assetHistory,
      trades,
      alerts,
      totalReturn,
      annualizedReturn,
      maxDrawdown,
      sharpeRatio,
      monthlyStats,
      assetAllocation
    };
  }

  calculateTotalReturn(pf) {
    const initialCash = this.trading.initialCash || 1000000;
    const totalReturn = ((pf.totalAssets - initialCash) / initialCash) * 100;
    return parseFloat(totalReturn.toFixed(2));
  }

  calculateAnnualizedReturn(pf, assetHistory) {
    const initialCash = this.trading.initialCash || 1000000;
    let days = 1;

    if (assetHistory.length > 1) {
      const firstTime = assetHistory[0].time;
      const lastTime = assetHistory[assetHistory.length - 1].time;
      days = Math.max(1, (lastTime - firstTime) / (24 * 60 * 60 * 1000));
    }

    const totalReturn = pf.totalAssets / initialCash;
    const annualized = (Math.pow(totalReturn, 365 / days) - 1) * 100;
    return parseFloat(annualized.toFixed(2));
  }

  calculateMaxDrawdown(assetHistory) {
    if (assetHistory.length < 2) {
      return { value: 0, peak: 0, trough: 0, peakTime: null, troughTime: null };
    }

    let peak = assetHistory[0].totalAssets;
    let maxDD = 0;
    let peakTime = assetHistory[0].time;
    let troughTime = assetHistory[0].time;
    let currentPeakTime = peakTime;

    assetHistory.forEach((record, i) => {
      if (record.totalAssets > peak) {
        peak = record.totalAssets;
        currentPeakTime = record.time;
      }
      const drawdown = ((peak - record.totalAssets) / peak) * 100;
      if (drawdown > maxDD) {
        maxDD = drawdown;
        peakTime = currentPeakTime;
        troughTime = record.time;
      }
    });

    return {
      value: parseFloat(maxDD.toFixed(2)),
      peak: parseFloat(peak.toFixed(2)),
      trough: parseFloat((peak * (1 - maxDD / 100)).toFixed(2)),
      peakTime,
      troughTime
    };
  }

  calculateSharpeRatio(assetHistory) {
    if (assetHistory.length < 2) {
      return 0;
    }

    const riskFreeRate = 0.03;
    const dailyReturns = [];

    for (let i = 1; i < assetHistory.length; i++) {
      const prev = assetHistory[i - 1].totalAssets;
      const curr = assetHistory[i].totalAssets;
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev);
      }
    }

    if (dailyReturns.length < 2) {
      return 0;
    }

    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return 0;
    }

    const dailyRiskFree = riskFreeRate / 365;
    const sharpe = Math.sqrt(365) * (avgReturn - dailyRiskFree) / stdDev;
    return parseFloat(sharpe.toFixed(2));
  }

  calculateMonthlyStats(trades) {
    const monthlyData = new Map();

    trades.forEach(trade => {
      if (trade.type === 'sell' && trade.profit !== undefined) {
        const date = new Date(trade.time);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(key)) {
          monthlyData.set(key, {
            month: key,
            totalProfit: 0,
            buyCount: 0,
            sellCount: 0,
            volume: 0
          });
        }

        const data = monthlyData.get(key);
        data.totalProfit += trade.profit;
        data.sellCount++;
        data.volume += trade.amount;
      }
    });

    trades.forEach(trade => {
      if (trade.type === 'buy') {
        const date = new Date(trade.time);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(key)) {
          monthlyData.set(key, {
            month: key,
            totalProfit: 0,
            buyCount: 0,
            sellCount: 0,
            volume: 0
          });
        }

        const data = monthlyData.get(key);
        data.buyCount++;
      }
    });

    return Array.from(monthlyData.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => ({
        ...d,
        totalProfit: parseFloat(d.totalProfit.toFixed(2))
      }));
  }

  calculateAssetAllocation(pf) {
    const allocation = [];
    const totalAssets = pf.totalAssets;

    if (totalAssets <= 0) {
      return allocation;
    }

    allocation.push({
      type: '现金',
      code: 'CASH',
      name: '可用资金',
      value: pf.cash,
      percentage: parseFloat(((pf.cash / totalAssets) * 100).toFixed(2))
    });

    pf.positions.forEach(pos => {
      allocation.push({
        type: '股票',
        code: pos.code,
        name: pos.name,
        value: pos.currentValue,
        percentage: parseFloat(((pos.currentValue / totalAssets) * 100).toFixed(2))
      });
    });

    return allocation.sort((a, b) => b.value - a.value);
  }

  renderAsciiChart(data, width = 60, height = 15, title = '') {
    if (!data || data.length === 0) {
      return '无数据';
    }

    const values = data.map(d => d.totalAssets);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const canvas = [];
    for (let i = 0; i < height; i++) {
      canvas.push(new Array(width).fill(' '));
    }

    const step = Math.max(1, Math.floor(data.length / width));

    for (let x = 0; x < width && x * step < data.length; x++) {
      const idx = x * step;
      const val = values[idx];
      const y = height - 1 - Math.floor(((val - minVal) / range) * (height - 1));

      if (y >= 0 && y < height) {
        const prevVal = idx > 0 ? values[idx - step] : val;
        canvas[y][x] = val >= prevVal ? '█' : '░';
      }
    }

    for (let y = 0; y < height; y++) {
      const val = maxVal - (y / (height - 1)) * range;
      const valStr = (val / 10000).toFixed(0).padStart(6) + '万';
      for (let i = 0; i < valStr.length; i++) {
        canvas[y][i] = valStr[i];
      }
      canvas[y][valStr.length] = '│';
    }

    canvas[height - 1][8] = '└';
    for (let x = 9; x < width; x++) {
      canvas[height - 1][x] = '─';
    }

    let result = '';
    if (title) {
      result += COLORS.bold + title + COLORS.reset + '\n';
    }
    result += canvas.map(row => row.join('')).join('\n');
    result += '\n' + ' '.repeat(8) + '└─';
    if (data.length > 0) {
      const startDate = new Date(data[0].time).toLocaleDateString('zh-CN');
      const endDate = new Date(data[data.length - 1].time).toLocaleDateString('zh-CN');
      result += ` 时间范围: ${startDate} ~ ${endDate} (${data.length} 个数据点)`;
    }
    return result;
  }

  renderPieChart(allocation, width = 50) {
    if (!allocation || allocation.length === 0) {
      return '无数据';
    }

    const colors = ['█', '▓', '▒', '░', '■', '□', '●', '○', '◆', '◇'];
    const result = [];
    result.push(COLORS.bold + '📊 资产配置' + COLORS.reset);
    result.push('='.repeat(70));

    let totalChars = 0;
    const charAllocations = allocation.map((item, i) => {
      const chars = Math.round((item.percentage / 100) * width);
      totalChars += chars;
      return { ...item, chars, symbol: colors[i % colors.length], color: i < 3 ? (i === 0 ? COLORS.yellow : COLORS.cyan) : COLORS.reset };
    });

    if (totalChars > width) {
      const diff = totalChars - width;
      for (let i = charAllocations.length - 1; i >= 0 && diff > 0; i--) {
        if (charAllocations[i].chars > 0) {
          charAllocations[i].chars--;
        }
      }
    }

    let pieLine = '';
    charAllocations.forEach(item => {
      pieLine += item.color + item.symbol.repeat(item.chars) + COLORS.reset;
    });
    result.push(pieLine);
    result.push('');

    charAllocations.forEach(item => {
      const name = item.name.length > 10 ? item.name.substring(0, 10) : item.name.padEnd(10);
      const pct = item.percentage.toFixed(2).padStart(6) + '%';
      const val = (item.value / 10000).toFixed(2).padStart(10) + '万';
      result.push(`${item.color}${item.symbol}${COLORS.reset} ${name}  ${pct}  ${val}`);
    });

    result.push('='.repeat(70));
    return result.join('\n');
  }

  renderReport() {
    const report = this.generateReport();
    const { portfolio, assetHistory, totalReturn, annualizedReturn, maxDrawdown, sharpeRatio, monthlyStats, assetAllocation } = report;

    console.log();
    console.log(`${COLORS.bold}📈 投资分析报表${COLORS.reset}`);
    console.log('='.repeat(80));
    console.log(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(80));

    console.log();
    console.log(`${COLORS.bold}💰 账户概览${COLORS.reset}`);
    console.log('-'.repeat(80));
    console.log(`初始资金: ${(this.trading.initialCash || 1000000).toLocaleString()} 元`);
    console.log(`当前总资产: ${COLORS.bold}${portfolio.totalAssets.toLocaleString()}${COLORS.reset} 元`);
    console.log(`可用资金: ${portfolio.cash.toLocaleString()} 元`);
    console.log(`持仓市值: ${portfolio.totalValue.toLocaleString()} 元`);

    console.log();
    console.log(`${COLORS.bold}📊 收益指标${COLORS.reset}`);
    console.log('-'.repeat(80));
    console.log(`累计收益率: ${colorChange(totalReturn, totalReturn)}`);
    console.log(`年化收益率: ${colorChange(annualizedReturn, annualizedReturn)}`);
    console.log(`最大回撤: ${COLORS.red}-${maxDrawdown.value}%${COLORS.reset} (峰值: ${maxDrawdown.peak.toLocaleString()} → 谷底: ${maxDrawdown.trough.toLocaleString()})`);
    console.log(`夏普比率: ${sharpeRatio >= 1 ? COLORS.green : COLORS.yellow}${sharpeRatio}${COLORS.reset} ${sharpeRatio >= 1 ? '(优秀)' : sharpeRatio >= 0.5 ? '(一般)' : '(较差)'}`);

    console.log();
    console.log(this.renderAsciiChart(assetHistory, 60, 15, '📈 总资产变化曲线'));
    console.log();

    console.log();
    console.log(`${COLORS.bold}📅 月度盈亏统计${COLORS.reset}`);
    console.log('='.repeat(80));
    console.log(`${COLORS.cyan}${'月份'.padEnd(12)}${'买入次数'.padEnd(12)}${'卖出次数'.padEnd(12)}${'盈亏金额'.padEnd(18)}${'成交额'}`);
    console.log('-'.repeat(80));

    if (monthlyStats.length === 0) {
      console.log(`${COLORS.yellow}暂无月度统计数据${COLORS.reset}`);
    } else {
      monthlyStats.forEach(stat => {
        const profitPercent = stat.buyCount > 0 ? (stat.totalProfit / (stat.buyCount * 10000)) * 100 : 0;
        const profitStr = colorChange(stat.totalProfit, profitPercent);
        const volumeStr = formatVolume(stat.volume);
        console.log(
          `${stat.month.padEnd(12)}${stat.buyCount.toString().padEnd(12)}${stat.sellCount.toString().padEnd(12)}${profitStr.padEnd(24)}${volumeStr}`
        );
      });
    }
    console.log('='.repeat(80));

    console.log();
    console.log(this.renderPieChart(assetAllocation, 50));
    console.log();

    const stats = this.tradeHistory.getStatistics();
    console.log(`${COLORS.bold}📋 交易统计${COLORS.reset}`);
    console.log('='.repeat(60));
    console.log(`总交易次数: ${stats.totalTrades}`);
    console.log(`盈利次数: ${COLORS.green}${stats.winningTrades}${COLORS.reset}    亏损次数: ${COLORS.red}${stats.losingTrades}${COLORS.reset}`);
    console.log(`胜率: ${stats.winRate.toFixed(2)}%`);
    console.log(`总盈亏: ${colorChange(stats.totalProfit, 0)}`);
    console.log(`盈亏比: ${stats.profitFactor.toFixed(2)}`);
    console.log('='.repeat(60));
    console.log();
  }

  exportHTML() {
    const report = this.generateReport();
    const { portfolio, assetHistory, totalReturn, annualizedReturn, maxDrawdown, sharpeRatio, monthlyStats, assetAllocation, trades, alerts } = report;

    const chartData = assetHistory.map(d => ({
      date: new Date(d.time).toLocaleString('zh-CN'),
      value: d.totalAssets
    }));

    const pieData = assetAllocation.map(a => ({
      name: a.name,
      value: a.value,
      percentage: a.percentage
    }));

    const monthlyData = monthlyStats.map(m => ({
      month: m.month,
      profit: m.totalProfit,
      buyCount: m.buyCount,
      sellCount: m.sellCount
    }));

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>投资分析报表</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .subtitle { opacity: 0.9; }
    .card { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .card h2 { font-size: 18px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; }
    .metric .label { font-size: 14px; color: #666; margin-bottom: 5px; }
    .metric .value { font-size: 24px; font-weight: bold; }
    .positive { color: #e74c3c; }
    .negative { color: #27ae60; }
    .chart-container { height: 300px; position: relative; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; }
    .tag-tp { background: #d4edda; color: #155724; }
    .tag-sl { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 投资分析报表</h1>
      <p class="subtitle">生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <div class="card">
      <h2>💰 账户概览</h2>
      <div class="metrics">
        <div class="metric">
          <div class="label">初始资金</div>
          <div class="value">¥${(this.trading.initialCash || 1000000).toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="label">总资产</div>
          <div class="value">¥${portfolio.totalAssets.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="label">可用资金</div>
          <div class="value">¥${portfolio.cash.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="label">持仓市值</div>
          <div class="value">¥${portfolio.totalValue.toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📊 收益指标</h2>
      <div class="metrics">
        <div class="metric">
          <div class="label">累计收益率</div>
          <div class="value ${totalReturn >= 0 ? 'positive' : 'negative'}">${totalReturn >= 0 ? '+' : ''}${totalReturn}%</div>
        </div>
        <div class="metric">
          <div class="label">年化收益率</div>
          <div class="value ${annualizedReturn >= 0 ? 'positive' : 'negative'}">${annualizedReturn >= 0 ? '+' : ''}${annualizedReturn}%</div>
        </div>
        <div class="metric">
          <div class="label">最大回撤</div>
          <div class="value negative">-${maxDrawdown.value}%</div>
        </div>
        <div class="metric">
          <div class="label">夏普比率</div>
          <div class="value">${sharpeRatio}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📈 总资产变化曲线</h2>
      <div class="chart-container">
        <canvas id="assetChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>📊 资产配置</h2>
      <div class="chart-container">
        <canvas id="allocationChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>📅 月度盈亏统计</h2>
      <div class="chart-container">
        <canvas id="monthlyChart"></canvas>
      </div>
    </div>

    <div class="card">
      <h2>📋 持仓明细</h2>
      <table>
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>持仓</th>
            <th>成本价</th>
            <th>现价</th>
            <th>市值</th>
            <th>盈亏</th>
            <th>盈亏比例</th>
            <th>止盈</th>
            <th>止损</th>
          </tr>
        </thead>
        <tbody>
          ${portfolio.positions.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:#999;">暂无持仓</td></tr>' : portfolio.positions.map(p => `
          <tr>
            <td>${p.code}</td>
            <td>${p.name}</td>
            <td>${p.quantity}</td>
            <td>${p.avgCost.toFixed(2)}</td>
            <td>${p.currentPrice.toFixed(2)}</td>
            <td>${p.currentValue.toFixed(2)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}</td>
            <td class="${p.profitPercent >= 0 ? 'positive' : 'negative'}">${p.profitPercent >= 0 ? '+' : ''}${p.profitPercent.toFixed(2)}%</td>
            <td>${p.takeProfit ? p.takeProfit.toFixed(2) : '-'}</td>
            <td>${p.stopLoss ? p.stopLoss.toFixed(2) : '-'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🔔 止盈止损记录</h2>
      <table>
        <thead>
          <tr>
            <th>触发时间</th>
            <th>类型</th>
            <th>代码</th>
            <th>名称</th>
            <th>数量</th>
            <th>触发价</th>
            <th>成交价</th>
            <th>盈亏</th>
          </tr>
        </thead>
        <tbody>
          ${alerts.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:#999;">暂无记录</td></tr>' : alerts.slice(0, 50).map(a => `
          <tr>
            <td>${new Date(a.time).toLocaleString('zh-CN')}</td>
            <td><span class="tag ${a.type === 'take_profit' ? 'tag-tp' : 'tag-sl'}">${a.type === 'take_profit' ? '止盈' : '止损'}</span></td>
            <td>${a.code}</td>
            <td>${a.name}</td>
            <td>${a.quantity}</td>
            <td>${a.triggerPrice.toFixed(2)}</td>
            <td>${a.currentPrice.toFixed(2)}</td>
            <td class="${a.profit >= 0 ? 'positive' : 'negative'}">${a.profit >= 0 ? '+' : ''}${a.profit.toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>📜 交易记录</h2>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>方向</th>
            <th>代码</th>
            <th>名称</th>
            <th>数量</th>
            <th>价格</th>
            <th>金额</th>
            <th>盈亏</th>
          </tr>
        </thead>
        <tbody>
          ${trades.slice(-50).reverse().map(t => `
          <tr>
            <td>${new Date(t.time).toLocaleString('zh-CN')}</td>
            <td>${t.type === 'buy' ? '买入' : '卖出'}${t.triggerType ? ' (' + (t.triggerType === 'take_profit' ? '止盈' : '止损') + ')' : ''}</td>
            <td>${t.code}</td>
            <td>${t.name}</td>
            <td>${t.quantity}</td>
            <td>${t.price.toFixed(2)}</td>
            <td>${t.amount.toFixed(2)}</td>
            <td class="${t.profit >= 0 ? 'positive' : 'negative'}">${t.type === 'sell' ? (t.profit >= 0 ? '+' : '') + t.profit.toFixed(2) : '-'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const chartData = ${JSON.stringify(chartData)};
    const pieData = ${JSON.stringify(pieData)};
    const monthlyData = ${JSON.stringify(monthlyData)};

    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140'];

    new Chart(document.getElementById('assetChart'), {
      type: 'line',
      data: {
        labels: chartData.map(d => d.date),
        datasets: [{
          label: '总资产 (元)',
          data: chartData.map(d => d.value),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    new Chart(document.getElementById('allocationChart'), {
      type: 'doughnut',
      data: {
        labels: pieData.map(d => d.name),
        datasets: [{
          data: pieData.map(d => d.value),
          backgroundColor: colors.slice(0, pieData.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.label + ': ¥' + ctx.raw.toLocaleString() + ' (' + pieData[ctx.dataIndex].percentage + '%)';
              }
            }
          }
        }
      }
    });

    new Chart(document.getElementById('monthlyChart'), {
      type: 'bar',
      data: {
        labels: monthlyData.map(d => d.month),
        datasets: [{
          label: '盈亏金额 (元)',
          data: monthlyData.map(d => d.profit),
          backgroundColor: monthlyData.map(d => d.profit >= 0 ? '#e74c3c' : '#27ae60')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  </script>
</body>
</html>`;

    const filePath = path.join(process.cwd(), `investment_report_${Date.now()}.html`);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');

    console.log();
    console.log(`${COLORS.green}✅ HTML报表已导出: ${filePath}${COLORS.reset}`);
    console.log(`${COLORS.cyan}💡 在浏览器中打开该文件查看交互式图表${COLORS.reset}`);
    console.log();

    return filePath;
  }
}

module.exports = ReportGenerator;
