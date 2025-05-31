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
  
  // Функция показа статистики
  async function showStats() {
    content.innerHTML = `
      <div class="stats-container">
        <h3>Финансовая аналитика</h3>
        
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
          
          <div class="control-group">
            <label>Период:</label>
            <select id="time-period">
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
              <option value="180">180 дней</option>
            </select>
          </div>
          
          <div class="control-group">
            <label>Интервал:</label>
            <select id="time-interval">
              <option value="hourly">Почасовой</option>
              <option value="daily" selected>Дневной</option>
              <option value="weekly">Недельный</option>
            </select>
          </div>
          
          <button id="update-chart" class="update-btn">Обновить графики</button>
        </div>
        
        <div class="chart-grid">
          <div class="chart-container">
            <h4>Динамика цен</h4>
            <canvas id="price-chart"></canvas>
          </div>
          
          <div class="chart-container">
            <h4>Волатильность</h4>
            <canvas id="volatility-chart"></canvas>
          </div>
          
          <div class="info-panel">
            <h4>Детализация</h4>
            <div id="asset-details" class="asset-details">
              <p>Выберите актив для просмотра детальной информации</p>
            </div>
            <div class="metrics-grid" id="metrics-container"></div>
          </div>
        </div>
      </div>
    `;

    // Инициализация контролов
    initAssetSelector();
    
    // Загрузка данных и построение графиков
    await loadAndDrawCharts();
    
    // Обработчики событий
    document.getElementById('update-chart').addEventListener('click', async () => {
      // Уничтожаем старые графики перед обновлением
      if (cryptoChart) cryptoChart.destroy();
      if (volatilityChart) volatilityChart.destroy();
      await loadAndDrawCharts();
    });
    
    document.getElementById('asset-type').addEventListener('change', initAssetSelector);
    document.getElementById('time-period').addEventListener('change', loadAndDrawCharts);
    document.getElementById('time-interval').addEventListener('change', loadAndDrawCharts);
  }

  // Инициализация выбора активов
  function initAssetSelector() {
    const assetType = document.getElementById('asset-type').value;
    const container = document.getElementById('asset-selector');
    container.innerHTML = '';
    
    if (assetType === 'crypto') {
      Object.keys(cryptoMap).slice(0, 6).forEach(crypto => {
        const id = `asset-${crypto}`;
        container.innerHTML += `
          <div class="asset-option">
            <input type="checkbox" id="${id}" value="${crypto}" checked>
            <label for="${id}">${crypto}</label>
          </div>
        `;
      });
    } else {
      fiatCodes.slice(0, 6).forEach(currency => {
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

  // Загрузка данных и построение графиков
  async function loadAndDrawCharts() {
    const assetType = document.getElementById('asset-type').value;
    const selectedAssets = getSelectedAssets();
    const period = document.getElementById('time-period').value;
    const interval = document.getElementById('time-interval').value;
    
    // Показать индикатор загрузки
    document.querySelectorAll('.chart-container canvas').forEach(canvas => {
      canvas.parentElement.classList.add('loading');
    });
    
    try {
      if (assetType === 'crypto') {
        await loadCryptoData(selectedAssets, period, interval);
        drawCryptoCharts();
      } else {
        await loadCurrencyData(selectedAssets, period, interval);
        drawCurrencyCharts();
      }
      
      // Обновить детализацию
      if (selectedAssets.length > 0) {
        updateAssetDetails(selectedAssets[0]);
      } else {
        updateAssetDetails(null);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      showChartError('Не удалось загрузить данные. Попробуйте позже.');
      updateAssetDetails(null);
    } finally {
      // Скрыть индикатор загрузки
      document.querySelectorAll('.chart-container canvas').forEach(canvas => {
        canvas.parentElement.classList.remove('loading');
      });
    }
  }

  // Загрузка данных для криптовалют
  async function loadCryptoData(assets, days, interval) {
    const cacheKey = `${assets.join('-')}-${days}-${interval}`;
    
    if (historyCache[cacheKey]) {
      return historyCache[cacheKey];
    }
    
    try {
      const coinIds = assets.map(a => cryptoMap[a]).join(',');
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&days=${days}&interval=${interval}&sparkline=true`;
      const proxyUrl = CORS_PROXY + encodeURIComponent(url);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Ошибка API: ' + response.status);
      
      const data = await response.json();
      
      // Проверка типа данных
      if (!Array.isArray(data)) {
        throw new Error('Ожидался массив, но получен объект');
      }
      
      const result = {};
      
      // Обработка каждого элемента массива
      data.forEach(coin => {
        // Поиск символа по ID
        const symbol = Object.keys(cryptoMap).find(
          key => cryptoMap[key] === coin.id
        );
        
        if (symbol && assets.includes(symbol)) {
          result[symbol] = {
            id: coin.id,
            name: coin.name,
            prices: coin.sparkline_in_7d?.price || [],
            marketCap: coin.market_cap || 0,
            volume: coin.total_volume || 0,
            change24h: coin.price_change_percentage_24h || 0,
            change7d: coin.price_change_percentage_7d_in_currency || 0,
            lastUpdated: coin.last_updated || new Date().toISOString()
          };
        }
      });
      
      // Добавление отсутствующих активов
      assets.forEach(asset => {
        if (!result[asset]) {
          result[asset] = {
            id: cryptoMap[asset],
            name: asset,
            prices: [],
            marketCap: 0,
            volume: 0,
            change24h: 0,
            change7d: 0,
            lastUpdated: new Date().toISOString()
          };
        }
      });
      
      historyCache[cacheKey] = result;
      return result;
      
    } catch (error) {
      console.error('Ошибка загрузки крипто данных:', error);
      // Возвращаем пустые данные при ошибке
      const result = {};
      assets.forEach(asset => {
        result[asset] = {
          prices: [],
          name: asset,
          change24h: 0,
          change7d: 0,
          lastUpdated: new Date().toISOString()
        };
      });
      return result;
    }
  }

  // Загрузка данных для валют
  async function loadCurrencyData(currencies, days, interval) {
    // Заглушка для фиатных валют
    return new Promise(resolve => {
      setTimeout(() => {
        const result = {};
        const now = Date.now();
        
        currencies.forEach(currency => {
          const prices = [];
          for (let i = 0; i < days; i++) {
            // Генерация случайных данных с трендом
            const baseValue = 0.8 + Math.random() * 0.4;
            const trend = Math.sin(i / days * Math.PI * 2) * 0.1;
            prices.push((baseValue + trend).toFixed(4));
          }
          
          result[currency] = {
            prices,
            change24h: (Math.random() - 0.5) * 3,
            change7d: (Math.random() - 0.5) * 5,
            name: currency
          };
        });
        
        resolve(result);
      }, 500);
    });
  }

  // Построение графиков для криптовалют
  function drawCryptoCharts() {
    const selectedAssets = getSelectedAssets();
    const period = parseInt(document.getElementById('time-period').value);
    const interval = document.getElementById('time-interval').value;
    
    const cacheKey = `${selectedAssets.join('-')}-${period}-${interval}`;
    const data = historyCache[cacheKey];
    
    // Проверка существования данных
    if (!data) {
      console.error('Данные не загружены');
      return;
    }
    
    // Получаем контекст для canvas
    const priceCanvas = document.getElementById('price-chart');
    const volCanvas = document.getElementById('volatility-chart');
    
    if (!priceCanvas || !volCanvas) {
      console.error('Canvas elements not found');
      return;
    }
    
    const priceCtx = priceCanvas.getContext('2d');
    const volCtx = volCanvas.getContext('2d');
    
    // Уничтожаем предыдущие графики
    if (cryptoChart) cryptoChart.destroy();
    if (volatilityChart) volatilityChart.destroy();
    
    // Рассчитываем временные метки
    const now = Date.now();
    const intervalMs = {
      hourly: 3600000,
      daily: 86400000,
      weekly: 604800000
    }[interval] || 86400000;
    
    const datasets = [];
    const colors = [
      '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', 
      '#e74a3b', '#858796', '#5a5c69', '#2e59d9'
    ];
    
    selectedAssets.forEach((asset, i) => {
      const assetData = data[asset];
      if (assetData && assetData.prices && assetData.prices.length > 0) {
        const points = assetData.prices.map((price, idx) => {
          const pointTime = now - (assetData.prices.length - idx - 1) * intervalMs;
          return { x: pointTime, y: price };
        });
        
        datasets.push({
          label: asset,
          data: points,
          borderColor: colors[i % colors.length],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1
        });
      }
    });
    
    // График цен
    if (datasets.length > 0) {
      cryptoChart = new Chart(priceCtx, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: interval === 'hourly' ? 'hour' : 'day',
                tooltipFormat: 'dd MMM yyyy HH:mm'
              },
              title: { display: true, text: 'Дата' }
            },
            y: {
              title: { display: true, text: 'Цена (USD)' },
              position: 'right'
            }
          },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: $${context.parsed.y.toFixed(4)}`;
                }
              }
            }
          }
        }
      });
    } else {
      priceCtx.clearRect(0, 0, priceCanvas.width, priceCanvas.height);
      priceCtx.fillText('Нет данных для построения графика', 10, 50);
    }
    
    // График волатильности
    const volatilityData = [];
    const labels = [];
    
    selectedAssets.forEach(asset => {
      const assetData = data[asset];
      if (!assetData || !assetData.prices || assetData.prices.length < 2) {
        volatilityData.push(0);
        return;
      }
      
      const prices = assetData.prices;
      let sum = 0;
      for (let i = 1; i < prices.length; i++) {
        const change = (prices[i] - prices[i-1]) / prices[i-1];
        sum += change * change;
      }
      
      volatilityData.push(Math.sqrt(sum / (prices.length - 1)) * 100);
      labels.push(asset);
    });
    
    if (volatilityData.length > 0) {
      volatilityChart = new Chart(volCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Волатильность (%)',
            data: volatilityData,
            backgroundColor: volatilityData.map((_, i) => colors[i % colors.length])
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Волатильность (%)' }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.parsed.y.toFixed(2)}%`;
                }
              }
            }
          }
        }
      });
    } else {
      volCtx.clearRect(0, 0, volCanvas.width, volCanvas.height);
      volCtx.fillText('Нет данных для построения графика', 10, 50);
    }
  }

  // Построение графиков для валют
  function drawCurrencyCharts() {
    // Заглушка для фиатных валют
    console.log('Draw currency charts placeholder');
  }

  // Показать ошибку на графике
  function showChartError(message) {
    document.querySelectorAll('.chart-container').forEach(container => {
      container.innerHTML = `<div class="chart-error">
        <p>${message}</p>
        <button onclick="location.reload()">Попробовать снова</button>
      </div>`;
    });
  }

  // Обновление детальной информации
  function updateAssetDetails(asset) {
    const detailsContainer = document.getElementById('asset-details');
    const metricsContainer = document.getElementById('metrics-container');
    
    detailsContainer.innerHTML = '';
    metricsContainer.innerHTML = '';

    if (!asset) {
      detailsContainer.innerHTML = '<p>Выберите актив для просмотра детальной информации</p>';
      return;
    }

    const cacheKey = `${getSelectedAssets().join('-')}-${document.getElementById('time-period').value}-${document.getElementById('time-interval').value}`;
    const cacheData = historyCache[cacheKey];
    
    if (!cacheData || !cacheData[asset]) {
      detailsContainer.innerHTML = `<p>Данные для ${asset} не загружены</p>`;
      return;
    }

    const data = cacheData[asset];
    
    // Проверка на наличие цен
    const hasPrices = data.prices && data.prices.length > 0;
    const lastPrice = hasPrices ? data.prices[data.prices.length - 1] : 0;
    
    detailsContainer.innerHTML = `
      <div class="asset-header">
        <h5>${asset} (${data.name || 'N/A'})</h5>
        <div class="price-change">
          <span class="${data.change24h >= 0 ? 'positive' : 'negative'}">
            ${data.change24h >= 0 ? '▲' : '▼'} ${Math.abs(data.change24h).toFixed(2)}% (24ч)
          </span>
          <span class="${data.change7d >= 0 ? 'positive' : 'negative'}">
            ${data.change7d >= 0 ? '▲' : '▼'} ${Math.abs(data.change7d).toFixed(2)}% (7д)
          </span>
        </div>
      </div>
      <div class="asset-meta">
        <span>Обновлено: ${new Date(data.lastUpdated).toLocaleString()}</span>
      </div>
    `;
    
    metricsContainer.innerHTML = `
      <div class="metric-card">
        <div class="metric-value">${hasPrices ? '$' + lastPrice.toLocaleString('en-US', {maximumFractionDigits: 4}) : 'N/A'}</div>
        <div class="metric-label">Текущая цена</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.volume ? '$' + (data.volume / 1000000).toFixed(2) + 'M' : 'N/A'}</div>
        <div class="metric-label">Объем (24ч)</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.marketCap ? '$' + (data.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A'}</div>
        <div class="metric-label">Капитализация</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.change24h.toFixed(2)}%</div>
        <div class="metric-label">Изменение (24ч)</div>
      </div>
    `;
  }
});
