document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('finance-content');
  const tabs = document.querySelectorAll('.finance-nav button');

  // Фиатные коды и карта крипто→ID
  const fiatCodes = ['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'BYN'];
  const cryptoMap = {
    BTC: { id: 'bitcoin', symbol: 'BTC' },
    ETH: { id: 'ethereum', symbol: 'ETH' },
    LTC: { id: 'litecoin', symbol: 'LTC' },
    DOGE: { id: 'dogecoin', symbol: 'DOGE' },
    BNB: { id: 'binancecoin', symbol: 'BNB' },
    USDT: { id: 'tether', symbol: 'USDT' },
    XRP: { id: 'ripple', symbol: 'XRP' },
    ADA: { id: 'cardano', symbol: 'ADA' },
    SOL: { id: 'solana', symbol: 'SOL' },
    DOT: { id: 'polkadot', symbol: 'DOT' },
    AVAX: { id: 'avalanche', symbol: 'AVAX' },
    MATIC: { id: 'matic-network', symbol: 'MATIC' }
  };

  // API ключ для CurrencyFreaks
  const CURRENCY_API_KEY = '24f59325463e418ca66aee20d46a0925';
  
  // Кэши
  const exchangeRatesCache = { rates: null, timestamp: 0 };
  const cryptoPricesCache = {};
  
  // Основной API для крипты
  const CRYPTO_API_URL = 'https://api.coingecko.com/api/v3';
  
  // Альтернативный API для крипты
  const BACKUP_CRYPTO_API = 'https://api.coincap.io/v2';
  
  // Функция для безопасных запросов
  async function safeFetch(url, isJson = true) {
    try {
      // Пробуем прямой запрос
      const response = await fetch(url);
      if (response.ok) {
        return isJson ? await response.json() : response;
      }
      
      // Пробуем через прокси если прямая ошибка
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const proxyResponse = await fetch(proxyUrl);
      
      if (proxyResponse.ok) {
        return isJson ? await proxyResponse.json() : proxyResponse;
      }
      
      throw new Error(`Ошибка запроса: ${response.status}`);
    } catch (error) {
      console.error('Ошибка запроса:', error);
      throw error;
    }
  }

  // Таб-переключатель
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'exchange') showExchange();
      else if (tab === 'wallet') showWallet();
      else if (tab === 'stats') showStats();
      else if (tab === 'nft') showNftFloor();
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

  // Получение цен криптовалют с кэшированием
  async function getCryptoPrice(coinId, vsCurrency) {
    const cacheKey = `${coinId}-${vsCurrency}`;
    const now = Date.now();
    
    // Проверка кэша
    if (cryptoPricesCache[cacheKey] && 
        (now - cryptoPricesCache[cacheKey].timestamp) < 300000) { // 5 минут
      return cryptoPricesCache[cacheKey].price;
    }
    
    try {
      // Пробуем CoinGecko API
      const url = `${CRYPTO_API_URL}/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`;
      const data = await safeFetch(url);
      
      if (data && data[coinId] && data[coinId][vsCurrency] !== undefined) {
        const price = data[coinId][vsCurrency];
        
        // Сохраняем в кэш
        cryptoPricesCache[cacheKey] = {
          price: price,
          timestamp: now
        };
        
        return price;
      }
      
      // Если CoinGecko не сработал, пробуем CoinCap
      const coinSymbol = Object.values(cryptoMap).find(c => c.id === coinId)?.symbol;
      if (coinSymbol) {
        const backupUrl = `${BACKUP_CRYPTO_API}/assets/${coinSymbol}`;
        const backupData = await safeFetch(backupUrl);
        
        if (backupData && backupData.data && backupData.data.priceUsd) {
          const usdPrice = parseFloat(backupData.data.priceUsd);
          
          // Для валют, отличных от USD, конвертируем
          if (vsCurrency === 'usd') {
            return usdPrice;
          } else {
            const rates = await getExchangeRates();
            if (rates && rates[vsCurrency.toUpperCase()]) {
              // Конвертируем USD в целевую валюту
              const rate = rates[vsCurrency.toUpperCase()];
              return usdPrice * rate;
            }
          }
        }
      }
      
      throw new Error('Курс не найден');
    } catch (error) {
      console.error('Ошибка получения курса криптовалюты:', error);
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

      // 2) Crypto → Crypto
      else if (isCrypto(f) && isCrypto(t)) {
        const idF = cryptoMap[f].id;
        const idT = cryptoMap[t].id;
        
        // Получаем цены в USD
        const usdF = await getCryptoPrice(idF, 'usd');
        const usdT = await getCryptoPrice(idT, 'usd');
        
        if (!usdF || !usdT) {
          throw new Error('Курсы криптовалют недоступны');
        }
        
        result = a * (usdF / usdT);
      }

      // 3) Crypto → Fiat
      else if (isCrypto(f) && isFiat(t)) {
        const idF = cryptoMap[f].id;
        const price = await getCryptoPrice(idF, t.toLowerCase());
        
        if (price === null) {
          throw new Error('Курс недоступен');
        }
        
        result = a * price;
      }

      // 4) Fiat → Crypto
      else if (isFiat(f) && isCrypto(t)) {
        const idT = cryptoMap[t].id;
        const price = await getCryptoPrice(idT, f.toLowerCase());
        
        if (price === null) {
          throw new Error('Курс недоступен');
        }
        
        result = a / price;
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
  
  function showStats() {
    content.innerHTML = `<h3>Статистика</h3><p>Графики и аналитика…</p>`;
  }
  
  function showNftFloor() {
    content.innerHTML = `
      <h3>NFT Floor Price</h3>
      <form id="nft-form" class="exchange-form">
        <label>Contract ID<input id="nft-contract" placeholder="bored-ape-kennel-club"></label>
        <label>В валюте<select id="nft-to">
          <option value="usd">USD</option>
          <option value="eth">ETH</option>
          <option value="btc">BTC</option>
        </select></label>
        <button>Показать floor</button>
      </form>
      <div id="nft-result" class="exchange-result"></div>
    `;
    
    document.getElementById('nft-form').onsubmit = async e => {
      e.preventDefault();
      const id = document.getElementById('nft-contract').value.trim();
      const to = document.getElementById('nft-to').value.toLowerCase();
      const out = document.getElementById('nft-result');
      
      if (!id) {
        out.textContent = 'Введите ID коллекции';
        return;
      }
      
      out.textContent = 'Загрузка…';
      out.classList.remove('error');
      
      try {
        const url = `https://api.coingecko.com/api/v3/nfts/${id}`;
        const data = await safeFetch(url);
        
        if (!data || !data.market_data) {
          throw new Error('Данные не найдены');
        }
        
        const price = data.market_data.floor_price?.[to];
        
        if (price) {
          out.innerHTML = `Floor: <strong>${price}</strong> ${to.toUpperCase()}`;
        } else {
          out.textContent = 'Цена не найдена';
          out.classList.add('error');
        }
      } catch (err) {
        console.error('Ошибка NFT:', err);
        out.textContent = 'Ошибка при запросе NFT. Попробуйте позже.';
        out.classList.add('error');
      }
    };
  }
});
