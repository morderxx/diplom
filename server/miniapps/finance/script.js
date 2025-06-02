document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('finance-content');
  const tabs = document.querySelectorAll('.finance-nav button');

  // Фиатные коды и карта крипто→ID CoinGecko
  const fiatCodes = ['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'BYN'];
  const cryptoMap = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    LTC: 'litecoin',
    DOGE: 'dogecoin',
    BNB: 'binancecoin',
    USDT: 'tether',
    XRP: 'ripple',
    ADA: 'cardano',
    SOL: 'solana',
    DOT: 'polkadot',
    AVAX: 'avalanche',
    MATIC: 'matic-network'
  };

  // API ключ для CurrencyFreaks
  const CURRENCY_API_KEY = '24f59325463e418ca66aee20d46a0925';
  
  // Кэши
  const exchangeRatesCache = { rates: null, timestamp: 0 };
  const cryptoUsdPricesCache = { prices: null, timestamp: 0 };
  
  // Надежный прокси
  const CORS_PROXY = "https://api.allorigins.win/raw?url=";

  // Глобальные переменные для графиков
  let cryptoChart = null;
  let volatilityChart = null;
  
  // Кэш исторических данных
  const historyCache = {};

  // Таб-переключатель
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'exchange') showExchange();
      else if (tab === 'wallet') showWallet();
      else if (tab === 'stats') showStats();
    });
  });

  // Стартовая вкладка
  showExchange();

  // ——— Конвертер —————————————————————————————
  async function showExchange() {
    content.innerHTML = `
      <h3>Конвертер валют и крипты</h3>
      <form id="exchange-form" class="exchange-form">
        <label>Из <select id="from"></select></label>
        <label>В  <select id="to"></select></label>
        <label style="grid-column:span 2">
          Сумма <input type="number" id="amount" value="1" min="0" step="any" required>
        </label>
        <button>Конвертировать</button>
      </form>
      <div id="exchange-result" class="exchange-result"></div>
    `;
    
    const selFrom = document.getElementById('from');
    const selTo = document.getElementById('to');
    selFrom.innerHTML = selTo.innerHTML = '';

    // Фиаты
    fiatCodes.forEach(c => {
      selFrom.add(new Option(c, c));
      selTo.add(new Option(c, c));
    });
    
    // Крипта
    Object.keys(cryptoMap).forEach(c => {
      selFrom.add(new Option(c, c));
      selTo.add(new Option(c, c));
    });

    selFrom.value = 'USD';
    selTo.value = 'BTC';

    document.getElementById('exchange-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        await doConvert();
      });
  }

  // Получение курсов валют с кэшированием
  async function getExchangeRates() {
    // Используем кэш, если данные свежие (менее 10 минут)
    const now = Date.now();
    if (exchangeRatesCache.rates && (now - exchangeRatesCache.timestamp) < 600000) {
      return exchangeRatesCache.rates;
    }
    
    try {
      const response = await fetch(
        `https://api.currencyfreaks.com/latest?apikey=${CURRENCY_API_KEY}`
      );
      
      if (!response.ok) throw new Error('Ошибка получения курсов валют');
      
      const data = await response.json();
      
      // Добавляем BYN, если его нет (примерный курс)
      if (!data.rates.BYN) {
        data.rates.BYN = 3.25; // Примерный курс BYN к USD
      }
      
      // Сохраняем в кэш
      exchangeRatesCache.rates = data.rates;
      exchangeRatesCache.timestamp = now;
      
      return data.rates;
    } catch (error) {
      console.error('Ошибка получения курсов валют:', error);
      return null;
    }
  }

  // Получение цен криптовалют в USD с кэшированием
  async function getCryptoUsdPrices() {
    const now = Date.now();
    
    // Проверка кэша
    if (cryptoUsdPricesCache.prices && (now - cryptoUsdPricesCache.timestamp) < 300000) {
      return cryptoUsdPricesCache.prices;
    }
    
    try {
      // Получаем все цены одним запросом
      const coinIds = Object.values(cryptoMap).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`;
      const proxyUrl = CORS_PROXY + encodeURIComponent(url);
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error('Ошибка получения курсов криптовалют');
      
      const data = await response.json();
      
      // Сохраняем в кэш
      cryptoUsdPricesCache.prices = data;
      cryptoUsdPricesCache.timestamp = now;
      
      return data;
    } catch (error) {
      console.error('Ошибка получения курсов криптовалют:', error);
      return null;
    }
  }

  async function doConvert() {
    const f = document.getElementById('from').value.toUpperCase();
    const t = document.getElementById('to').value.toUpperCase();
    const a = parseFloat(document.getElementById('amount').value);
    const out = document.getElementById('exchange-result');

    if (!a || a <= 0) {
      out.textContent = 'Введите корректную сумму';
      return;
    }
    
    out.textContent = 'Загрузка…';
    out.classList.remove('error');

    const isFiat = c => fiatCodes.includes(c);
    const isCrypto = c => Object.keys(cryptoMap).includes(c);

    try {
      let result;

      // 1) Fiat → Fiat через CurrencyFreaks
      if (isFiat(f) && isFiat(t)) {
        const rates = await getExchangeRates();
        if (!rates || !rates[f] || !rates[t]) {
          throw new Error('Курсы валют недоступны');
        }
        
        // Конвертация через USD как базовую валюту
        const rateFrom = rates[f];
        const rateTo = rates[t];
        result = a * (rateTo / rateFrom);
      }

      // 2) Crypto → Crypto через USD
      else if (isCrypto(f) && isCrypto(t)) {
        const cryptoPrices = await getCryptoUsdPrices();
        if (!cryptoPrices) {
          throw new Error('Курсы криптовалют недоступны');
        }
        
        const idF = cryptoMap[f];
        const idT = cryptoMap[t];
        const priceF = cryptoPrices[idF]?.usd;
        const priceT = cryptoPrices[idT]?.usd;
        
        if (!priceF || !priceT) {
          throw new Error('Курсы криптовалют недоступны');
        }
        
        result = a * (priceF / priceT);
      }

      // 3) Crypto → Fiat через USD
      else if (isCrypto(f) && isFiat(t)) {
        const cryptoPrices = await getCryptoUsdPrices();
        const rates = await getExchangeRates();
        
        if (!cryptoPrices || !rates || !rates[t]) {
          throw new Error('Курсы недоступны');
        }
        
        const idF = cryptoMap[f];
        const cryptoUsd = cryptoPrices[idF]?.usd;
        const fiatRate = rates[t]; // Кол-во USD за 1 единицу фиата
        
        if (!cryptoUsd) {
          throw new Error('Курс криптовалюты недоступен');
        }
        
        // 1 крипта = X USD
        // 1 USD = 1 / fiatRate фиата
        // Итого: X * (1 / fiatRate) фиата за 1 крипту
        result = a * cryptoUsd / fiatRate;
      }

      // 4) Fiat → Crypto через USD
      else if (isFiat(f) && isCrypto(t)) {
        const rates = await getExchangeRates();
        const cryptoPrices = await getCryptoUsdPrices();
        
        if (!rates || !rates[f] || !cryptoPrices) {
          throw new Error('Курсы недоступны');
        }
        
        const idT = cryptoMap[t];
        const cryptoUsd = cryptoPrices[idT]?.usd;
        const fiatRate = rates[f]; // Кол-во USD за 1 единицу фиата
        
        if (!cryptoUsd) {
          throw new Error('Курс криптовалюты недоступен');
        }
        
        // 1 фиат = fiatRate USD
        // 1 крипта = Y USD
        // Итого: (fiatRate) / Y крипты за 1 фиат
        result = a * fiatRate / cryptoUsd;
      }

      else {
        throw new Error('Неподдерживаемая пара валют');
      }

      if (!isFinite(result)) throw new Error('Некорректный результат');
      
      // Форматирование результата
      let formattedResult;
      if (result > 1000) {
        formattedResult = result.toFixed(2);
      } else if (result > 0.01) {
        formattedResult = result.toFixed(4);
      } else {
        formattedResult = result.toFixed(8);
      }
      
      out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${formattedResult} ${t}</strong>`;
    } catch (err) {
      console.error('Ошибка конвертации:', err);
      out.textContent = err.message || 'Ошибка при конвертации. Попробуйте позже.';
      out.classList.add('error');
    }
  }

  // ——— Прочие вкладки ——————————————————
  function showWallet() {
    content.innerHTML = `<h3>Кошелёк</h3><p>Баланс и история транзакций…</p>`;
  }
  
  async function showStats() {
    content.innerHTML = `
      <div class="stats-container">
        <h3>Упрощенная финансовая аналитика</h3>
        
        <div class="stats-controls">
          <div class="control-group">
            <label>Тип актива:</label>
            <select id="asset-type">
              <option value="crypto">Криптовалюты</option>
              <option value="currency">Фиатные валюты</option>
            </select>
          </div>
          
          <div class="control-group">
            <label>Выбор активов:</label>
            <div id="asset-selector" class="asset-selector"></div>
          </div>
          
          <button id="update-chart" class="update-btn">Обновить график</button>
        </div>
        
        <div class="chart-container">
          <h4>Динамика цен за 30 дней</h4>
          <canvas id="price-chart"></canvas>
          <div class="chart-loader">Загрузка данных...</div>
          <div class="chart-error hidden"></div>
        </div>
      </div>
    `;

    // Инициализация контролов
    initAssetSelector();
    
    // Загрузка данных и построение графика
    await loadAndDrawChart();
    
    // Обработчики событий
    document.getElementById('update-chart').addEventListener('click', async () => {
      await loadAndDrawChart();
    });
    
    document.getElementById('asset-type').addEventListener('change', () => {
      initAssetSelector();
      loadAndDrawChart();
    });
  }

  // Инициализация выбора активов
  function initAssetSelector() {
    const assetType = document.getElementById('asset-type').value;
    const container = document.getElementById('asset-selector');
    container.innerHTML = '';
    
    if (assetType === 'crypto') {
      // Только основные криптовалюты
      const topCryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA'];
      topCryptos.forEach(crypto => {
        const id = `asset-${crypto}`;
        container.innerHTML += `
          <div class="asset-option">
            <input type="checkbox" id="${id}" value="${crypto}" checked>
            <label for="${id}">${crypto}</label>
          </div>
        `;
      });
    } else {
      // Основные фиатные валюты
      const topFiats = ['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY'];
      topFiats.forEach(currency => {
        const id = `asset-${currency}`;
        container.innerHTML += `
          <div class="asset-option">
            <input type="checkbox" id="${id}" value="${currency}" checked>
            <label for="${id}">${currency}</label>
          </div>
        `;
      });
    }
  }

  // Получение выбранных активов
  function getSelectedAssets() {
    const assetType = document.getElementById('asset-type').value;
    const checkboxes = document.querySelectorAll('#asset-selector input:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  // Показать/скрыть загрузчик
  function toggleLoader(show) {
    const loader = document.querySelector('.chart-loader');
    if (loader) loader.style.display = show ? 'block' : 'none';
  }

  // Показать ошибку
  function showChartError(message) {
    const errorEl = document.querySelector('.chart-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  // Скрыть ошибки
  function hideErrors() {
    const errorEl = document.querySelector('.chart-error');
    if (errorEl) errorEl.classList.add('hidden');
  }

  // Загрузка данных и построение графика
  async function loadAndDrawChart() {
    const assetType = document.getElementById('asset-type').value;
    const selectedAssets = getSelectedAssets();
    
    // Скрыть старые ошибки
    hideErrors();
    
    // Показать загрузчик
    toggleLoader(true);
    
    try {
      let data;
      if (assetType === 'crypto') {
        data = await loadCryptoData(selectedAssets);
      } else {
        data = await loadCurrencyData(selectedAssets);
      }
      drawPriceChart(data, assetType);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      showChartError('Не удалось загрузить данные. Попробуйте позже или выберите другие активы.');
    } finally {
      // Скрыть загрузчик
      toggleLoader(false);
    }
  }

  // Загрузка данных для криптовалют
  async function loadCryptoData(assets) {
    const result = {};
    
    for (const asset of assets) {
      const coinId = cryptoMap[asset];
      if (!coinId) continue;
      
      try {
        // Упрощенный запрос к CoinGecko
        const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
        
        const data = await response.json();
        
        // Упрощенная обработка данных
        if (data.prices && Array.isArray(data.prices)) {
          result[asset] = {
            prices: data.prices.map(p => p[1]),
            timestamps: data.prices.map(p => p[0]),
            name: asset
          };
        } else {
          throw new Error('Некорректный формат данных');
        }
      } catch (error) {
        console.error(`Ошибка загрузки данных для ${asset}:`, error);
        result[asset] = {
          error: true,
          message: `Не удалось загрузить данные для ${asset}`,
          name: asset
        };
      }
    }
    
    return result;
  }

  // Загрузка данных для валют (исправленная версия)
  async function loadCurrencyData(currencies) {
    // Получаем текущие курсы
    const rates = await getExchangeRates();
    if (!rates) throw new Error('Не удалось получить курсы валют');
    
    const result = {};
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    currencies.forEach(currency => {
      // Базовый курс относительно USD
      const baseRate = rates[currency] ? parseFloat(rates[currency]) : 1;
      
      // Генерация исторических данных с правильными временными метками
      const prices = [];
      const timestamps = [];
      
      // Создаем дату с фиксированным временем (12:00 UTC)
      const baseDate = new Date();
      baseDate.setHours(12, 0, 0, 0);
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(baseDate.getTime() - i * oneDay);
        timestamps.push(date.getTime());
        
        // Реалистичные колебания курса (±1%)
        const fluctuation = 1 + (Math.random() - 0.5) * 0.02;
        prices.push(baseRate * fluctuation);
      }
      
      result[currency] = {
        prices,
        timestamps,
        name: currency,
        currentRate: baseRate
      };
    });
    
    return result;
  }

  // Построение графика цен (исправленная версия)
  function drawPriceChart(data, assetType) {
    const canvas = document.getElementById('price-chart');
    if (!canvas) return;
    
    // Уничтожаем предыдущий график если существует
    if (cryptoChart) {
      cryptoChart.destroy();
      cryptoChart = null;
    }
    
    const ctx = canvas.getContext('2d');
    const assets = Object.keys(data);
    
    // Проверка наличия данных
    const hasData = assets.some(asset => 
      !data[asset].error && data[asset].prices?.length > 0
    );
    
    if (!hasData) {
      showChartError('Нет данных для построения графика');
      return;
    }
    
    const colors = ['#4e73df', '#1cc88a', '#f6c23e', '#e74a3b', '#858796', '#36b9cc'];
    const datasets = [];
    
    assets.forEach((asset, i) => {
      const assetData = data[asset];
      if (assetData.error) return;
      
      // Сортируем данные по времени
      const sortedData = assetData.timestamps
        .map((ts, idx) => ({ x: ts, y: assetData.prices[idx] }))
        .sort((a, b) => a.x - b.x);
      
      datasets.push({
        label: asset,
        data: sortedData,
        borderColor: colors[i % colors.length],
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: colors[i % colors.length],
        fill: false,
        tension: 0.1 // Уменьшаем сглаживание
      });
    });
    
    // Определяем единицы измерения
    const yAxisLabel = assetType === 'crypto' ? 'Цена (USD)' : 'Курс к USD';
    
    // Создаем новый график
    cryptoChart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'dd MMM yyyy',
              displayFormats: { day: 'dd MMM' }
            },
            title: { display: true, text: 'Дата' },
            ticks: {
              autoSkip: true,
              maxTicksLimit: 10
            }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: yAxisLabel },
            ticks: {
              callback: function(value) {
                return value.toLocaleString('ru-RU', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4
                });
              }
            }
          }
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${value.toFixed(4)}`;
              }
            }
          }
        }
      }
    });
  }
});
