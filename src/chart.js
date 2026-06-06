class AsciiChart {
  constructor(width = 80, height = 20) {
    this.width = width;
    this.height = height;
  }

  clearCanvas() {
    const canvas = [];
    for (let i = 0; i < this.height; i++) {
      canvas.push(new Array(this.width).fill(' '));
    }
    return canvas;
  }

  canvasToString(canvas) {
    return canvas.map(row => row.join('')).join('\n');
  }

  renderPriceChart(data, indicators = null, title = '') {
    if (!data || data.length === 0) {
      return '无数据';
    }
    
    const canvas = this.clearCanvas();
    const prices = data.map(d => d.close || d.price);
    
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    
    if (indicators) {
      const allValues = [...prices];
      
      if (indicators.MA5) {
        indicators.MA5.forEach(v => v !== null && allValues.push(v));
      }
      if (indicators.MA10) {
        indicators.MA10.forEach(v => v !== null && allValues.push(v));
      }
      if (indicators.MA20) {
        indicators.MA20.forEach(v => v !== null && allValues.push(v));
      }
      if (indicators.Bollinger) {
        indicators.Bollinger.upper.forEach(v => v !== null && allValues.push(v));
        indicators.Bollinger.lower.forEach(v => v !== null && allValues.push(v));
      }
      
      minPrice = Math.min(...allValues);
      maxPrice = Math.max(...allValues);
    }
    
    const priceRange = maxPrice - minPrice || 1;
    const plotWidth = this.width - 12;
    const plotHeight = this.height - 2;
    const step = Math.max(1, Math.floor(data.length / plotWidth));
    
    for (let x = 0; x < plotWidth && x * step < data.length; x++) {
      const idx = x * step;
      const price = prices[idx];
      const y = plotHeight - 1 - Math.floor(((price - minPrice) / priceRange) * (plotHeight - 1));
      
      if (y >= 0 && y < plotHeight) {
        canvas[y][x + 10] = prices[idx] >= (prices[idx - 1] || prices[idx]) ? '█' : '░';
      }
    }
    
    if (indicators) {
      this._drawMA(canvas, indicators.MA5, data, step, plotWidth, plotHeight, minPrice, priceRange, '5', 10);
      this._drawMA(canvas, indicators.MA10, data, step, plotWidth, plotHeight, minPrice, priceRange, 'A', 10);
      this._drawMA(canvas, indicators.MA20, data, step, plotWidth, plotHeight, minPrice, priceRange, 'B', 10);
      
      if (indicators.Bollinger) {
        this._drawMA(canvas, indicators.Bollinger.upper, data, step, plotWidth, plotHeight, minPrice, priceRange, 'U', 10);
        this._drawMA(canvas, indicators.Bollinger.lower, data, step, plotWidth, plotHeight, minPrice, priceRange, 'L', 10);
      }
    }
    
    for (let y = 0; y < plotHeight; y++) {
      const price = maxPrice - (y / (plotHeight - 1)) * priceRange;
      const priceStr = price.toFixed(2).padStart(8);
      canvas[y][0] = '│';
      for (let i = 0; i < priceStr.length; i++) {
        canvas[y][1 + i] = priceStr[i];
      }
    }
    
    canvas[plotHeight][0] = '└';
    for (let x = 1; x < this.width; x++) {
      canvas[plotHeight][x] = '─';
    }
    
    let result = '';
    if (title) {
      result += title + '\n';
    }
    result += this.canvasToString(canvas);
    result += '\n' + this._renderLegend(indicators);
    
    return result;
  }

  _drawMA(canvas, maData, data, step, plotWidth, plotHeight, minPrice, priceRange, symbol, offset) {
    if (!maData) return;
    
    const prices = data.map(d => d.close || d.price);
    
    for (let x = 0; x < plotWidth && x * step < data.length; x++) {
      const idx = x * step;
      if (maData[idx] === null) continue;
      
      const y = plotHeight - 1 - Math.floor(((maData[idx] - minPrice) / priceRange) * (plotHeight - 1));
      
      if (y >= 0 && y < plotHeight) {
        if (canvas[y][x + offset] === ' ' || canvas[y][x + offset] === '░' || canvas[y][x + offset] === '█') {
          canvas[y][x + offset] = symbol;
        }
      }
    }
  }

  _renderLegend(indicators) {
    if (!indicators) return '';
    
    const legend = ['图例: '];
    legend.push('█/░ 价格走势');
    
    if (indicators.MA5) legend.push('5 MA5');
    if (indicators.MA10) legend.push('A MA10');
    if (indicators.MA20) legend.push('B MA20');
    if (indicators.Bollinger) {
      legend.push('U 布林上轨');
      legend.push('L 布林下轨');
    }
    
    return legend.join('  ');
  }

  renderVolumeChart(data, height = 6) {
    if (!data || data.length === 0) {
      return '无数据';
    }
    
    const canvas = [];
    const plotWidth = this.width - 12;
    const volumes = data.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;
    const step = Math.max(1, Math.floor(data.length / plotWidth));
    
    for (let i = 0; i < height; i++) {
      canvas.push(new Array(this.width).fill(' '));
    }
    
    for (let x = 0; x < plotWidth && x * step < data.length; x++) {
      const idx = x * step;
      const volume = volumes[idx] || 0;
      const barHeight = Math.floor((volume / maxVolume) * (height - 1));
      
      for (let y = 0; y < barHeight; y++) {
        canvas[height - 2 - y][x + 10] = '│';
      }
    }
    
    for (let y = 0; y < height - 1; y++) {
      canvas[y][0] = '│';
    }
    
    canvas[height - 1][0] = '└';
    for (let x = 1; x < this.width; x++) {
      canvas[height - 1][x] = '─';
    }
    
    const volStr = (maxVolume / 10000).toFixed(0) + '万';
    for (let i = 0; i < volStr.length; i++) {
      canvas[0][1 + i] = volStr[i];
    }
    
    return '成交量\n' + canvas.map(row => row.join('')).join('\n');
  }

  renderRSIChart(data, height = 6) {
    if (!data || data.length === 0) {
      return '无数据';
    }
    
    const canvas = [];
    const plotWidth = this.width - 12;
    const step = Math.max(1, Math.floor(data.length / plotWidth));
    
    for (let i = 0; i < height; i++) {
      canvas.push(new Array(this.width).fill(' '));
    }
    
    for (let y = 0; y < height; y++) {
      canvas[y][0] = '│';
      canvas[y][plotWidth + 10] = '│';
      
      const rsiValue = 100 - (y / (height - 1)) * 100;
      const rsiStr = rsiValue.toFixed(0).padStart(3);
      for (let i = 0; i < rsiStr.length; i++) {
        canvas[y][1 + i] = rsiStr[i];
      }
      
      if (rsiValue === 70 || rsiValue === 30) {
        for (let x = 10; x < this.width - 1; x++) {
          canvas[y][x] = '-';
        }
      }
    }
    
    for (let x = 0; x < plotWidth && x * step < data.length; x++) {
      const idx = x * step;
      const rsi = data[idx];
      if (rsi === null) continue;
      
      const y = height - 1 - Math.floor((rsi / 100) * (height - 1));
      if (y >= 0 && y < height) {
        const symbol = rsi > 70 ? 'S' : (rsi < 30 ? 'B' : '·');
        canvas[y][x + 10] = symbol;
      }
    }
    
    canvas[height - 1][0] = '└';
    for (let x = 1; x < this.width; x++) {
      canvas[height - 1][x] = '─';
    }
    
    return 'RSI (S=超买 B=超卖)\n' + canvas.map(row => row.join('')).join('\n');
  }
}

const asciiChart = new AsciiChart(80, 18);
module.exports = asciiChart;
