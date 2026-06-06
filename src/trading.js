const market = require('./market');
const { getStockByCode } = require('./stocks');
const { colorPrice, colorChange, formatVolume, COLORS } = require('./display');

class TradingSystem {
  constructor() {
    this.cash = 1000000;
    this.portfolio = new Map();
    this.orders = [];
    this.orderIdCounter = 0;
    this.tradeHistory = [];
  }

  buy(code, quantity, type = 'market', price = null) {
    const stock = market.getStock(code);
    if (!stock) {
      return { success: false, message: `股票不存在: ${code}` };
    }

    if (quantity <= 0 || quantity % 100 !== 0) {
      return { success: false, message: '数量必须为100的正整数倍' };
    }

    let orderPrice = type === 'market' ? stock.currentPrice : price;
    const totalCost = orderPrice * quantity;
    const commission = Math.max(totalCost * 0.0003, 5);
    const totalAmount = totalCost + commission;

    if (type === 'limit' && price <= 0) {
      return { success: false, message: '限价单价格必须大于0' };
    }

    if (type === 'market' && totalAmount > this.cash) {
      return { success: false, message: `资金不足，需要 ${totalAmount.toFixed(2)}，当前可用 ${this.cash.toFixed(2)}` };
    }

    const order = {
      id: ++this.orderIdCounter,
      type: 'buy',
      code,
      name: stock.name,
      quantity,
      orderType: type,
      price: orderPrice,
      status: type === 'market' ? 'filled' : 'pending',
      createTime: Date.now(),
      fillTime: type === 'market' ? Date.now() : null
    };

    if (type === 'market') {
      this._executeBuy(order);
      return {
        success: true,
        message: `买入 ${stock.name} ${quantity}股，成交价 ${orderPrice.toFixed(2)}，总金额 ${totalAmount.toFixed(2)}`
      };
    } else {
      if (totalAmount > this.cash) {
        return { success: false, message: `资金不足，冻结资金 ${totalAmount.toFixed(2)}，当前可用 ${this.cash.toFixed(2)}` };
      }
      this.cash -= totalAmount;
      this.orders.push(order);
      return {
        success: true,
        message: `限价买单已提交，委托价 ${price.toFixed(2)}，等待成交...`
      };
    }
  }

  sell(code, quantity, type = 'market', price = null) {
    const stock = market.getStock(code);
    if (!stock) {
      return { success: false, message: `股票不存在: ${code}` };
    }

    if (quantity <= 0 || quantity % 100 !== 0) {
      return { success: false, message: '数量必须为100的正整数倍' };
    }

    const position = this.portfolio.get(code);
    if (!position || position.quantity < quantity) {
      return { success: false, message: `持仓不足，当前持仓 ${position ? position.quantity : 0}股` };
    }

    let orderPrice = type === 'market' ? stock.currentPrice : price;

    if (type === 'limit' && price <= 0) {
      return { success: false, message: '限价单价格必须大于0' };
    }

    const order = {
      id: ++this.orderIdCounter,
      type: 'sell',
      code,
      name: stock.name,
      quantity,
      orderType: type,
      price: orderPrice,
      status: type === 'market' ? 'filled' : 'pending',
      createTime: Date.now(),
      fillTime: type === 'market' ? Date.now() : null
    };

    if (type === 'market') {
      this._executeSell(order);
      const revenue = orderPrice * quantity;
      const commission = Math.max(revenue * 0.0003, 5);
      const stampDuty = revenue * 0.001;
      const netAmount = revenue - commission - stampDuty;
      return {
        success: true,
        message: `卖出 ${stock.name} ${quantity}股，成交价 ${orderPrice.toFixed(2)}，净收入 ${netAmount.toFixed(2)}`
      };
    } else {
      position.quantity -= quantity;
      position.frozenQuantity = (position.frozenQuantity || 0) + quantity;
      this.orders.push(order);
      return {
        success: true,
        message: `限价卖单已提交，委托价 ${price.toFixed(2)}，等待成交...`
      };
    }
  }

  _executeBuy(order) {
    const totalCost = order.price * order.quantity;
    const commission = Math.max(totalCost * 0.0003, 5);
    const totalAmount = totalCost + commission;

    this.cash -= totalAmount;

    const position = this.portfolio.get(order.code);
    if (position) {
      const totalQuantity = position.quantity + order.quantity;
      const totalCostBasis = position.avgCost * position.quantity + totalCost;
      position.quantity = totalQuantity;
      position.avgCost = parseFloat((totalCostBasis / totalQuantity).toFixed(2));
    } else {
      this.portfolio.set(order.code, {
        code: order.code,
        name: order.name,
        quantity: order.quantity,
        avgCost: parseFloat((totalCost / order.quantity).toFixed(2)),
        frozenQuantity: 0
      });
    }

    this.tradeHistory.push({
      time: Date.now(),
      type: 'buy',
      code: order.code,
      name: order.name,
      quantity: order.quantity,
      price: order.price,
      amount: totalAmount,
      commission,
      profit: 0
    });

    order.status = 'filled';
    order.fillTime = Date.now();
  }

  _executeSell(order) {
    const revenue = order.price * order.quantity;
    const commission = Math.max(revenue * 0.0003, 5);
    const stampDuty = revenue * 0.001;
    const netAmount = revenue - commission - stampDuty;

    const position = this.portfolio.get(order.code);
    const costBasis = position.avgCost * order.quantity;
    const profit = netAmount - costBasis;

    this.cash += netAmount;

    position.quantity -= order.quantity;
    if (position.frozenQuantity) {
      position.frozenQuantity -= order.quantity;
    }

    if (position.quantity <= 0) {
      this.portfolio.delete(order.code);
    }

    this.tradeHistory.push({
      time: Date.now(),
      type: 'sell',
      code: order.code,
      name: order.name,
      quantity: order.quantity,
      price: order.price,
      amount: netAmount,
      commission: commission + stampDuty,
      profit: parseFloat(profit.toFixed(2))
    });

    order.status = 'filled';
    order.fillTime = Date.now();
  }

  checkOrders() {
    const pendingOrders = this.orders.filter(o => o.status === 'pending');
    
    pendingOrders.forEach(order => {
      const stock = market.getStock(order.code);
      if (!stock) return;
      
      if (order.type === 'buy') {
        if (stock.currentPrice <= order.price) {
          const totalCost = order.price * order.quantity;
          const commission = Math.max(totalCost * 0.0003, 5);
          const totalAmount = totalCost + commission;
          
          if (this.cash >= totalAmount) {
            this._executeBuy(order);
          } else {
            order.status = 'cancelled';
          }
        }
      } else if (order.type === 'sell') {
          if (stock.currentPrice >= order.price) {
            this._executeSell(order);
          }
        }
      });
    
    this.orders = this.orders.filter(o => o.status !== 'filled');
  }

  getPortfolio() {
    const positions = [];
    let totalValue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    this.portfolio.forEach((position, code) => {
      const stock = market.getStock(code);
      if (!stock) return;

      const currentValue = stock.currentPrice * position.quantity;
      const costValue = position.avgCost * position.quantity;
      const profit = currentValue - costValue;
      const profitPercent = (profit / costValue) * 100;

      positions.push({
        ...position,
        currentPrice: stock.currentPrice,
        currentValue: parseFloat(currentValue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        profitPercent: parseFloat(profitPercent.toFixed(2))
      });

      totalValue += currentValue;
      totalCost += costValue;
      totalProfit += profit;
    });

    return {
      positions,
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalProfitPercent: totalCost > 0 ? parseFloat(((totalProfit / totalCost) * 100).toFixed(2)) : 0,
      cash: parseFloat(this.cash.toFixed(2)),
      totalAssets: parseFloat((this.cash + totalValue).toFixed(2))
    };
  }

  getOrders() {
    return [...this.orders];
  }

  getTradeHistory() {
    return [...this.tradeHistory];
  }

  renderPortfolio() {
    const pf = this.getPortfolio();

    console.log();
    console.log(`${COLORS.bold}💼 持仓列表${COLORS.reset}`);
    console.log('='.repeat(100));
    console.log(`${COLORS.cyan}${'代码'.padEnd(10)}${'名称'.padEnd(12)}${'持仓'.padEnd(10)}${'成本价'.padEnd(12)}${'现价'.padEnd(12)}${'市值'.padEnd(14)}${'盈亏'.padEnd(16)}${'盈亏比例'}`);
    console.log('-'.repeat(100));

    if (pf.positions.length === 0) {
      console.log(`${COLORS.yellow}暂无持仓${COLORS.reset}`);
    } else {
      pf.positions.forEach(pos => {
        const priceStr = colorPrice(pos.currentPrice, pos.avgCost);
        const profitStr = colorChange(pos.profit, pos.profitPercent);
        
        console.log(
          `${pos.code.padEnd(10)}${pos.name.padEnd(12)}${pos.quantity.toString().padEnd(10)}${pos.avgCost.toFixed(2).padEnd(12)}${priceStr.padEnd(12)}${pos.currentValue.toFixed(2).padEnd(14)}${profitStr}`
        );
      });
    }

    console.log('='.repeat(100));
    console.log(`可用资金: ${COLORS.green}${pf.cash.toFixed(2)}${COLORS.reset}`);
    console.log(`持仓市值: ${pf.totalValue.toFixed(2)}`);
    console.log(`持仓盈亏: ${colorChange(pf.totalProfit, pf.totalProfitPercent)}`);
    console.log(`总资产: ${COLORS.bold}${pf.totalAssets.toFixed(2)}${COLORS.reset}`);
    console.log();

    const orders = this.getOrders();
    if (orders.length > 0) {
      console.log(`${COLORS.bold}📋 委托订单${COLORS.reset}`);
      console.log('='.repeat(80));
      console.log(`${COLORS.cyan}${'订单号'.padEnd(10)}${'方向'.padEnd(8)}${'代码'.padEnd(10)}${'数量'.padEnd(10)}${'委托价'.padEnd(12)}${'类型'.padEnd(10)}${'状态'}`);
      console.log('-'.repeat(80));
      orders.forEach(order => {
        const typeStr = order.type === 'buy' ? `${COLORS.red}买入${COLORS.reset}` : `${COLORS.green}卖出${COLORS.reset}`;
        const statusColor = order.status === 'pending' ? COLORS.yellow : order.status === 'filled' ? COLORS.green : COLORS.red;
        console.log(
          `${order.id.toString().padEnd(10)}${typeStr.padEnd(8)}${order.code.padEnd(10)}${order.quantity.toString().padEnd(10)}${order.price.toFixed(2).padEnd(12)}${(order.orderType === 'market' ? '市价' : '限价').padEnd(10)}${statusColor}${order.status}${COLORS.reset}`
        );
      });
      console.log('='.repeat(80));
    }
  }
}

const trading = new TradingSystem();

setInterval(() => {
  if (market.isRunning) {
    trading.checkOrders();
  }
}, 1000);

module.exports = trading;
