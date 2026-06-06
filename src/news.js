const { getSectors, getStockList, getStocksBySector } = require('./stocks');

const NEWS_TEMPLATES = {
  positive: [
    {
      title: '{name}业绩超预期，净利润同比增长{value}%',
      valueRange: [20, 80]
    },
    {
      title: '{name}获得大额订单，金额达{value}亿元',
      valueRange: [5, 50]
    },
    {
      title: '{name}发布新产品，市场反应热烈',
      valueRange: null
    },
    {
      title: '{name}与知名企业达成战略合作协议',
      valueRange: null
    },
    {
      title: '{name}获得政策利好支持，行业景气度上升',
      valueRange: null
    },
    {
      title: '{name}产能扩张计划获批，未来增长可期',
      valueRange: null
    },
    {
      title: '机构上调{name}评级至"强烈推荐"，目标价上调{value}%',
      valueRange: [10, 30]
    },
    {
      title: '{name}核心技术取得突破，竞争力大幅提升',
      valueRange: null
    }
  ],
  negative: [
    {
      title: '{name}业绩不及预期，净利润同比下滑{value}%',
      valueRange: [20, 60]
    },
    {
      title: '{name}遭遇监管处罚，罚款金额{value}亿元',
      valueRange: [1, 10]
    },
    {
      title: '{name}高管减持股份，引发市场担忧',
      valueRange: null
    },
    {
      title: '{name}产品质量问题曝光，品牌形象受损',
      valueRange: null
    },
    {
      title: '{name}所属行业政策收紧，业绩承压',
      valueRange: null
    },
    {
      title: '机构下调{name}评级至"减持"，目标价下调{value}%',
      valueRange: [10, 30]
    },
    {
      title: '{name}主要客户流失，订单量大幅下降',
      valueRange: null
    },
    {
      title: '{name}商誉减值风险暴露，或计提大额损失',
      valueRange: null
    }
  ],
  neutral: [
    {
      title: '{name}召开股东大会，审议年度报告',
      valueRange: null
    },
    {
      title: '{name}发布股份回购进展公告',
      valueRange: null
    },
    {
      title: '{name}新增对外投资，布局新业务领域',
      valueRange: null
    },
    {
      title: '{name}发布股权激励计划，绑定核心团队',
      valueRange: null
    },
    {
      title: '分析师发布{name}研究报告，维持"中性"评级',
      valueRange: null
    },
    {
      title: '{name}中标项目公示，金额约{value}亿元',
      valueRange: [1, 10]
    }
  ]
};

class NewsManager {
  constructor() {
    this.newsList = [];
    this.isEnabled = true;
    this.intervalId = null;
    this.eventListeners = [];
  }

  _getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _selectTarget() {
    const targetType = Math.random();
    const sectors = getSectors();
    const stocks = getStockList();

    if (targetType < 0.3) {
      const sector = this._getRandomItem(sectors);
      const sectorStocks = getStocksBySector(sector);
      return {
        type: 'sector',
        sector,
        targets: sectorStocks.map(s => s.code),
        name: sector
      };
    } else {
      const stock = this._getRandomItem(stocks);
      return {
        type: 'stock',
        targets: [stock.code],
        name: stock.name,
        code: stock.code,
        sector: stock.sector
      };
    }
  }

  _generateNews() {
    const rand = Math.random();
    let type;
    if (rand < 0.4) {
      type = 'positive';
    } else if (rand < 0.75) {
      type = 'negative';
    } else {
      type = 'neutral';
    }

    const templates = NEWS_TEMPLATES[type];
    const template = this._getRandomItem(templates);
    const target = this._selectTarget();

    let title = template.title.replace('{name}', target.name);
    if (template.valueRange) {
      const value = this._getRandomInt(template.valueRange[0], template.valueRange[1]);
      title = title.replace('{value}', value.toString());
    }

    let impact = 0;
    if (type === 'positive') {
      impact = 0.25 * (0.6 + Math.random() * 0.4);
    } else if (type === 'negative') {
      impact = -0.25 * (0.6 + Math.random() * 0.4);
    }

    const news = {
      id: Date.now(),
      time: new Date(),
      type,
      title,
      target,
      impact: parseFloat(impact.toFixed(4)),
      impactPercent: parseFloat((impact * 100).toFixed(2)),
      affected: target.targets
    };

    this.newsList.unshift(news);
    if (this.newsList.length > 100) {
      this.newsList.pop();
    }

    this._notifyListeners(news);

    return news;
  }

  _notifyListeners(news) {
    this.eventListeners.forEach(listener => {
      try {
        listener(news);
      } catch (e) {
        console.error('新闻监听器出错:', e);
      }
    });
  }

  onNews(listener) {
    if (typeof listener === 'function') {
      this.eventListeners.push(listener);
    }
  }

  offNews(listener) {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  start() {
    if (this.intervalId) return;

    this.isEnabled = true;
    this.intervalId = setInterval(() => {
      if (this.isEnabled) {
        const news = this._generateNews();
        if (news.type !== 'neutral') {
          const typeLabel = news.type === 'positive' ? '利好' : '利空';
          const color = news.type === 'positive' ? '\x1b[32m' : '\x1b[31m';
          const reset = '\x1b[0m';
          const timeStr = news.time.toLocaleTimeString('zh-CN');
          console.log(`\n${color}📰 [${timeStr}] ${typeLabel}新闻: ${news.title}${reset}`);
          console.log(`   影响: ${news.impactPercent > 0 ? '+' : ''}${news.impactPercent}% (${news.target.type === 'sector' ? '板块' : '个股'})\n`);
        }
      }
    }, 30000);

    console.log('📰 新闻事件模拟已启动，每30秒生成一条市场新闻...');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isEnabled = false;
    console.log('📰 新闻事件模拟已停止');
  }

  enable() {
    this.isEnabled = true;
    if (!this.intervalId) {
      this.start();
    } else {
      console.log('📰 新闻事件模拟已开启');
    }
  }

  disable() {
    this.isEnabled = false;
    console.log('📰 新闻事件模拟已关闭');
  }

  getRecentNews(count = 20) {
    return this.newsList.slice(0, count);
  }

  getNewsByType(type) {
    return this.newsList.filter(n => n.type === type);
  }

  getNewsByTarget(codeOrSector) {
    return this.newsList.filter(n =>
      n.target.name === codeOrSector ||
      (n.target.targets && n.target.targets.includes(codeOrSector))
    );
  }

  getPendingImpacts() {
    const now = Date.now();
    const activeWindow = 60 * 1000;

    return this.newsList
      .filter(n => n.type !== 'neutral' && (now - n.time.getTime()) < activeWindow)
      .map(n => ({
        ...n,
        remainingTime: activeWindow - (now - n.time.getTime())
      }));
  }
}

const newsManager = new NewsManager();
module.exports = newsManager;
