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
  
  function showStats() {
    content.innerHTML = `<h3>Статистика</h3><p>Графики и аналитика…</p>`;
  }
  
function showNftFloor() {
  // Популярные NFT коллекции с их ID для CoinGecko
  const popularNfts = [
    { id: 'bored-ape-yacht-club', name: 'Bored Ape Yacht Club' },
    { id: 'cryptopunks', name: 'CryptoPunks' },
    { id: 'azuki', name: 'Azuki' },
    { id: 'doodles', name: 'Doodles' },
    { id: 'clonex', name: 'CloneX' },
    { id: 'mutant-ape-yacht-club', name: 'Mutant Ape YC' },
    { id: 'otherdeed', name: 'Otherdeed' },
    { id: 'cool-cats', name: 'Cool Cats' },
    { id: 'world-of-women', name: 'World of Women' },
    { id: 'mfers', name: 'mfers' }
  ];

  content.innerHTML = `
    <h3>NFT Floor Price</h3>
    <form id="nft-form" class="exchange-form">
      <label>Коллекция
        <select id="nft-collection">
          ${popularNfts.map(nft => 
            `<option value="${nft.id}">${nft.name}</option>`
          ).join('')}
        </select>
      </label>
      
      <label>В валюте
        <select id="nft-to">
          <option value="usd">USD</option>
          <option value="eth">ETH</option>
          <option value="btc">BTC</option>
          <option value="bnb">BNB</option>
          <option value="sol">SOL</option>
        </select>
      </label>
      
      <button>Показать floor</button>
    </form>
    <div id="nft-result" class="exchange-result"></div>
    <div class="nft-info">
      <p>Floor price - минимальная цена предмета в коллекции</p>
      <p>Данные предоставлены CoinGecko</p>
    </div>
  `;
  
  document.getElementById('nft-form').onsubmit = async e => {
    e.preventDefault();
    const id = document.getElementById('nft-collection').value;
    const to = document.getElementById('nft-to').value.toLowerCase();
    const out = document.getElementById('nft-result');
    const collectionName = popularNfts.find(nft => nft.id === id)?.name || 'NFT Collection';
    
    out.textContent = 'Загрузка…';
    out.classList.remove('error');
    
    try {
      // Защита от слишком частых запросов
      const lastRequestTime = window.lastNftRequestTime || 0;
      if (Date.now() - lastRequestTime < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - (Date.now() - lastRequestTime)));
      }
      window.lastNftRequestTime = Date.now();

      // Используем прокси для CoinGecko API
      const url = `https://api.coingecko.com/api/v3/nfts/${id}`;
      const proxyUrl = CORS_PROXY + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        // Пробуем прочитать текст ошибки
        const errorText = await response.text();
        throw new Error(`Ошибка ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // Проверяем наличие данных - новый способ
      let floorPrice;
      let currency = to;
      
      // Способ 1: Современная структура данных
      if (data.market_data?.floor_price?.[to] !== undefined) {
        floorPrice = data.market_data.floor_price[to];
      }
      // Способ 2: Старая структура данных
      else if (data.floor_price_in_native_currency !== undefined && 
               data.native_currency === to) {
        floorPrice = data.floor_price_in_native_currency;
      }
      // Способ 3: Общая структура
      else if (data.floor_price?.[to] !== undefined) {
        floorPrice = data.floor_price[to];
      }
      // Способ 4: Цена в ETH всегда доступна
      else if (data.market_data?.floor_price?.eth !== undefined) {
        floorPrice = data.market_data.floor_price.eth;
        currency = 'eth';
      }
      
      // Если ни один способ не сработал
      if (floorPrice === undefined) {
        console.warn('Данные о цене не найдены в ответе:', data);
        throw new Error('Цена для этой коллекции не найдена');
      }
      
      // Если получили цену в ETH, но нужна другая валюта
      if (currency === 'eth' && to !== 'eth') {
        const cryptoPrices = await getCryptoUsdPrices();
        if (!cryptoPrices) throw new Error('Курсы криптовалют недоступны');
        
        const ethUsd = cryptoPrices.ethereum?.usd;
        if (!ethUsd) throw new Error('Курс ETH недоступен');
        
        let targetPrice;
        switch(to) {
          case 'usd': 
            targetPrice = ethUsd;
            break;
          case 'btc': 
            targetPrice = cryptoPrices.bitcoin?.usd;
            break;
          case 'bnb': 
            targetPrice = cryptoPrices.binancecoin?.usd;
            break;
          case 'sol': 
            targetPrice = cryptoPrices.solana?.usd;
            break;
          default:
            throw new Error('Валюта недоступна');
        }
        
        if (!targetPrice) throw new Error(`Курс ${to.toUpperCase()} недоступен`);
        
        // Конвертируем: (floorPrice * ethUsd) / targetPrice
        floorPrice = (floorPrice * ethUsd) / targetPrice;
        currency = to;
      }
      
      // Форматируем цену
      let formattedPrice;
      if (floorPrice > 1000) {
        formattedPrice = floorPrice.toFixed(0);
      } else if (floorPrice > 1) {
        formattedPrice = floorPrice.toFixed(2);
      } else if (floorPrice > 0.01) {
        formattedPrice = floorPrice.toFixed(4);
      } else {
        formattedPrice = floorPrice.toFixed(6);
      }
      
      out.innerHTML = `
        <div class="nft-price">
          <strong>Floor: ${formattedPrice} ${currency.toUpperCase()}</strong>
        </div>
        <div class="nft-meta">
          <span>${collectionName}</span>
        </div>
      `;
    } catch (err) {
      console.error('Ошибка NFT:', err);
      out.innerHTML = `
        <div class="nft-error">
          Ошибка: ${err.message || 'Неизвестная ошибка'}
        </div>
        <div class="nft-meta">
          <span>${collectionName}</span>
        </div>
      `;
      out.classList.add('error');
    }
  };
}
});
