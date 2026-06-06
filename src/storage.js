const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const ASSET_HISTORY_FILE = path.join(DATA_DIR, 'asset_history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function savePortfolio(cash, portfolio, orderIdCounter) {
  ensureDataDir();
  
  const portfolioData = {
    cash,
    positions: Array.from(portfolio.entries()).map(([code, pos]) => ({
      code,
      name: pos.name,
      quantity: pos.quantity,
      avgCost: pos.avgCost,
      frozenQuantity: pos.frozenQuantity || 0,
      takeProfit: pos.takeProfit !== undefined ? pos.takeProfit : null,
      stopLoss: pos.stopLoss !== undefined ? pos.stopLoss : null
    })),
    orderIdCounter,
    savedAt: Date.now()
  };
  
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolioData, null, 2), 'utf-8');
  return portfolioData;
}

function loadPortfolio() {
  if (!fs.existsSync(PORTFOLIO_FILE)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf-8'));
    const portfolio = new Map();
    
    data.positions.forEach(pos => {
      portfolio.set(pos.code, {
        code: pos.code,
        name: pos.name,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
        frozenQuantity: pos.frozenQuantity || 0,
        takeProfit: pos.takeProfit !== undefined ? pos.takeProfit : null,
        stopLoss: pos.stopLoss !== undefined ? pos.stopLoss : null
      });
    });
    
    return {
      cash: data.cash,
      portfolio,
      orderIdCounter: data.orderIdCounter || 0,
      savedAt: data.savedAt
    };
  } catch (err) {
    console.error(`加载持仓数据失败: ${err.message}`);
    return null;
  }
}

function saveTradeHistory(tradeHistory) {
  ensureDataDir();
  
  const historyData = {
    trades: tradeHistory,
    savedAt: Date.now()
  };
  
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2), 'utf-8');
  return historyData;
}

function loadTradeHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return [];
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    return data.trades || [];
  } catch (err) {
    console.error(`加载交易历史失败: ${err.message}`);
    return [];
  }
}

function saveOrders(orders) {
  ensureDataDir();
  
  const ordersData = {
    orders,
    savedAt: Date.now()
  };
  
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersData, null, 2), 'utf-8');
  return ordersData;
}

function loadOrders() {
  if (!fs.existsSync(ORDERS_FILE)) {
    return [];
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
    return data.orders || [];
  } catch (err) {
    console.error(`加载委托单失败: ${err.message}`);
    return [];
  }
}

function saveAll(cash, portfolio, orderIdCounter, tradeHistory, orders) {
  savePortfolio(cash, portfolio, orderIdCounter);
  saveTradeHistory(tradeHistory);
  saveOrders(orders);
}

function clearAll() {
  if (fs.existsSync(PORTFOLIO_FILE)) {
    fs.unlinkSync(PORTFOLIO_FILE);
  }
  if (fs.existsSync(HISTORY_FILE)) {
    fs.unlinkSync(HISTORY_FILE);
  }
  if (fs.existsSync(ORDERS_FILE)) {
    fs.unlinkSync(ORDERS_FILE);
  }
  if (fs.existsSync(WATCHLIST_FILE)) {
    fs.unlinkSync(WATCHLIST_FILE);
  }
  if (fs.existsSync(ALERTS_FILE)) {
    fs.unlinkSync(ALERTS_FILE);
  }
  if (fs.existsSync(ASSET_HISTORY_FILE)) {
    fs.unlinkSync(ASSET_HISTORY_FILE);
  }
}

function hasSavedData() {
  return fs.existsSync(PORTFOLIO_FILE) || 
         fs.existsSync(HISTORY_FILE) || 
         fs.existsSync(ORDERS_FILE);
}

function saveWatchlist(watchlist) {
  ensureDataDir();
  const data = {
    stocks: watchlist,
    savedAt: Date.now()
  };
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf-8'));
    return data.stocks || [];
  } catch (err) {
    console.error(`加载自选股失败: ${err.message}`);
    return [];
  }
}

function saveAlerts(alerts) {
  ensureDataDir();
  const data = {
    alerts,
    savedAt: Date.now()
  };
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function loadAlerts() {
  if (!fs.existsSync(ALERTS_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
    return data.alerts || [];
  } catch (err) {
    console.error(`加载止盈止损记录失败: ${err.message}`);
    return [];
  }
}

function saveAssetHistory(assetHistory) {
  ensureDataDir();
  const data = {
    history: assetHistory,
    savedAt: Date.now()
  };
  fs.writeFileSync(ASSET_HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function loadAssetHistory() {
  if (!fs.existsSync(ASSET_HISTORY_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(ASSET_HISTORY_FILE, 'utf-8'));
    return data.history || [];
  } catch (err) {
    console.error(`加载资产历史失败: ${err.message}`);
    return [];
  }
}

module.exports = {
  savePortfolio,
  loadPortfolio,
  saveTradeHistory,
  loadTradeHistory,
  saveOrders,
  loadOrders,
  saveAll,
  clearAll,
  hasSavedData,
  saveWatchlist,
  loadWatchlist,
  saveAlerts,
  loadAlerts,
  saveAssetHistory,
  loadAssetHistory,
  DATA_DIR
};
