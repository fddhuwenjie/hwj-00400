const STOCKS = [
  { code: '600519', name: '贵州茅台', industry: '白酒', sector: '白酒', basePrice: 1688.88 },
  { code: '000858', name: '五粮液', industry: '白酒', sector: '白酒', basePrice: 158.66 },
  { code: '000568', name: '泸州老窖', industry: '白酒', sector: '白酒', basePrice: 188.55 },
  { code: '000001', name: '平安银行', industry: '银行', sector: '银行', basePrice: 12.38 },
  { code: '600036', name: '招商银行', industry: '银行', sector: '银行', basePrice: 35.62 },
  { code: '601318', name: '中国平安', industry: '保险', sector: '银行', basePrice: 48.55 },
  { code: '002230', name: '科大讯飞', industry: '人工智能', sector: '科技', basePrice: 48.67 },
  { code: '002415', name: '海康威视', industry: '安防', sector: '科技', basePrice: 35.28 },
  { code: '688981', name: '中芯国际', industry: '半导体', sector: '科技', basePrice: 52.36 },
  { code: '002475', name: '立讯精密', industry: '电子', sector: '科技', basePrice: 32.18 },
  { code: '000333', name: '美的集团', industry: '家电', sector: '科技', basePrice: 58.90 },
  { code: '300059', name: '东方财富', industry: '证券', sector: '科技', basePrice: 16.85 },
  { code: '601899', name: '紫金矿业', industry: '有色金属', sector: '科技', basePrice: 15.23 },
  { code: '600276', name: '恒瑞医药', industry: '医药', sector: '医药', basePrice: 45.80 },
  { code: '603259', name: '药明康德', industry: '医药', sector: '医药', basePrice: 68.50 },
  { code: '000538', name: '云南白药', industry: '医药', sector: '医药', basePrice: 56.30 },
  { code: '300760', name: '迈瑞医疗', industry: '医药', sector: '医药', basePrice: 288.60 },
  { code: '600887', name: '伊利股份', industry: '食品饮料', sector: '医药', basePrice: 38.90 },
  { code: '300750', name: '宁德时代', industry: '新能源', sector: '新能源', basePrice: 198.33 },
  { code: '002594', name: '比亚迪', industry: '汽车', sector: '新能源', basePrice: 268.45 },
  { code: '600900', name: '长江电力', industry: '电力', sector: '新能源', basePrice: 28.77 },
  { code: '002714', name: '牧原股份', industry: '农业', sector: '新能源', basePrice: 42.56 },
  { code: '601088', name: '中国神华', industry: '煤炭', sector: '新能源', basePrice: 38.45 },
  { code: '601888', name: '中国中免', industry: '旅游', sector: '新能源', basePrice: 78.90 }
];

const SECTORS = ['白酒', '银行', '科技', '医药', '新能源'];

function getStockList() {
  return STOCKS.map(s => ({ ...s }));
}

function getStockByCode(code) {
  return STOCKS.find(s => s.code === code) || null;
}

function getStockCodes() {
  return STOCKS.map(s => s.code);
}

function getSectors() {
  return [...SECTORS];
}

function getStocksBySector(sectorName) {
  return STOCKS.filter(s => s.sector === sectorName).map(s => ({ ...s }));
}

module.exports = {
  getStockList,
  getStockByCode,
  getStockCodes,
  getSectors,
  getStocksBySector,
  STOCKS,
  SECTORS
};
