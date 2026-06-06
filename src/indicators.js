function SMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(parseFloat((sum / period).toFixed(2)));
    }
  }
  return result;
}

function EMA(data, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  
  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += data[i];
    result.push(null);
  }
  
  let ema = sma / period;
  result[period - 1] = parseFloat(ema.toFixed(2));
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
    result.push(parseFloat(ema.toFixed(2)));
  }
  
  return result;
}

function RSI(data, period = 14) {
  const result = [];
  const changes = [];
  
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let gains = 0;
      let losses = 0;
      
      for (let j = i - period; j < i; j++) {
        const change = changes[j];
        if (change > 0) {
          gains += change;
        } else {
          losses -= change;
        }
      }
      
      const avgGain = gains / period;
      const avgLoss = losses / period;
      
      let rsi;
      if (avgLoss === 0) {
        rsi = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
      
      result.push(parseFloat(rsi.toFixed(2)));
    }
  }
  
  return result;
}

function MACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = EMA(data, fastPeriod);
  const slowEMA = EMA(data, slowPeriod);
  
  const macdLine = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(parseFloat((fastEMA[i] - slowEMA[i]).toFixed(2)));
    }
  }
  
  const validMacd = macdLine.filter(v => v !== null);
  const signalLineBase = EMA(validMacd, signalPeriod);
  
  const signalLine = [];
  const nullCount = macdLine.length - validMacd.length;
  
  for (let i = 0; i < nullCount; i++) {
    signalLine.push(null);
  }
  for (let i = 0; i < signalLineBase.length; i++) {
    signalLine.push(signalLineBase[i]);
  }
  
  const histogram = [];
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(parseFloat((macdLine[i] - signalLine[i]).toFixed(2)));
    }
  }
  
  return { macdLine, signalLine, histogram };
}

function BollingerBands(data, period = 20, stdDev = 2) {
  const sma = SMA(data, period);
  const upper = [];
  const middle = [];
  const lower = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i];
      
      let variance = 0;
      for (let j = 0; j < slice.length; j++) {
        variance += Math.pow(slice[j] - mean, 2);
      }
      variance /= period;
      const std = Math.sqrt(variance);
      
      upper.push(parseFloat((mean + stdDev * std).toFixed(2)));
      middle.push(mean);
      lower.push(parseFloat((mean - stdDev * std).toFixed(2)));
    }
  }
  
  return { upper, middle, lower };
}

function calculateAllIndicators(priceData) {
  if (!priceData || priceData.length === 0) {
    return null;
  }
  
  const closes = priceData.map(d => d.close || d.price);
  
  return {
    MA5: SMA(closes, 5),
    MA10: SMA(closes, 10),
    MA20: SMA(closes, 20),
    RSI: RSI(closes, 14),
    MACD: MACD(closes),
    Bollinger: BollingerBands(closes, 20, 2)
  };
}

function getLatestIndicators(priceData) {
  const indicators = calculateAllIndicators(priceData);
  if (!indicators) return null;
  
  const lastIndex = priceData.length - 1;
  
  return {
    MA5: indicators.MA5[lastIndex],
    MA10: indicators.MA10[lastIndex],
    MA20: indicators.MA20[lastIndex],
    RSI: indicators.RSI[lastIndex],
    MACD: indicators.MACD.macdLine[lastIndex],
    MACD_Signal: indicators.MACD.signalLine[lastIndex],
    MACD_Histogram: indicators.MACD.histogram[lastIndex],
    BB_Upper: indicators.Bollinger.upper[lastIndex],
    BB_Middle: indicators.Bollinger.middle[lastIndex],
    BB_Lower: indicators.Bollinger.lower[lastIndex]
  };
}

module.exports = {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  calculateAllIndicators,
  getLatestIndicators
};
