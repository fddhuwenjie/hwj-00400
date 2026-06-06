const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

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
      frozenQuantity: pos.frozenQuantity || 0
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
        frozenQuantity: pos.frozenQuantity || 0
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
}

function hasSavedData() {
  return fs.existsSync(PORTFOLIO_FILE) || 
         fs.existsSync(HISTORY_FILE) || 
         fs.existsSync(ORDERS_FILE);
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
  DATA_DIR
};
