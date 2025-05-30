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
  // Обновленные данные популярных NFT коллекций
  const popularNfts = [
    { id: 'bored-ape-yacht-club', name: 'Bored Ape Yacht Club', contract: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' },
    { id: 'cryptopunks', name: 'CryptoPunks', contract: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb' },
    { id: 'azuki', name: 'Azuki', contract: '0xed5af388653567af2f388e6224dc7c4b3241c544' },
    { id: 'doodles', name: 'Doodles', contract: '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e' },
    { id: 'clonex', name: 'CloneX', contract: '0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b' },
    { id: 'mutant-ape-yacht-club', name: 'Mutant Ape YC', contract: '0x60e4d786628fea6478f785a6d7e704777c86a7c6' },
    { id: 'otherdeed', name: 'Otherdeed', contract: '0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258' },
    { id: 'cool-cats', name: 'Cool Cats', contract: '0x1a92f7381b9f03921564a437210bb9396471050c' },
    { id: 'world-of-women', name: 'World of Women', contract: '0xe785e82358879f061bc3dcac6f0444462d4b5330' },
    { id: 'mfers', name: 'mfers', contract: '0x79fcdef22feed20eddacbb2587640e45491b757f' }
  ];

  content.innerHTML = `
    <h3>NFT Floor Price</h3>
    <form id="nft-form" class="exchange-form">
      <label>Коллекция
        <select id="nft-collection">
          ${popularNfts.map(nft => 
            `<option value="${nft.contract}">${nft.name}</option>`
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
      <p>Данные предоставлены OpenSea</p>
    </div>
  `;
  
  document.getElementById('nft-form').onsubmit = async e => {
    e.preventDefault();
    const contract = document.getElementById('nft-collection').value;
    const to = document.getElementById('nft-to').value.toLowerCase();
    const out = document.getElementById('nft-result');
    
    out.textContent = 'Загрузка…';
    out.classList.remove('error');
    
    try {
      // Используем OpenSea API вместо CoinGecko
      const url = `https://api.opensea.io/api/v2/collections/${contract}/stats`;
      const response = await fetch(url, {
        headers: {
          // OpenSea требует API ключ для v2 API
          'X-API-KEY': '2b6efc3a3e1c4047b0a1b3d7a1e0e7a9'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Ошибка ${response.status}`);
      }
      
      const data = await response.json();
      
      // Получаем floor price в ETH
      const floorEth = data.total?.floor_price;
      
      if (!floorEth) throw new Error('Floor price не найден');
      
      // Конвертируем в выбранную валюту
      let resultPrice;
      let currencySymbol;
      
      switch(to) {
        case 'eth':
          resultPrice = floorEth;
          currencySymbol = 'ETH';
          break;
        case 'usd':
          // Для конвертации ETH в USD используем CoinGecko
          const ethPrice = await getCryptoUsdPrices().then(prices => prices?.ethereum?.usd);
          if (!ethPrice) throw new Error('Не удалось получить курс ETH');
          resultPrice = floorEth * ethPrice;
          currencySymbol = 'USD';
          break;
        case 'btc':
          // Конвертация ETH → BTC
          const btcPrice = await getCryptoUsdPrices().then(prices => prices?.bitcoin?.usd);
          const ethPriceBtc = await getCryptoUsdPrices().then(prices => prices?.ethereum?.usd);
          if (!btcPrice || !ethPriceBtc) throw new Error('Не удалось получить курсы');
          resultPrice = (floorEth * ethPriceBtc) / btcPrice;
          currencySymbol = 'BTC';
          break;
        case 'bnb':
          // Конвертация ETH → BNB
          const bnbPrice = await getCryptoUsdPrices().then(prices => prices?.binancecoin?.usd);
          const ethPriceBnb = await getCryptoUsdPrices().then(prices => prices?.ethereum?.usd);
          if (!bnbPrice || !ethPriceBnb) throw new Error('Не удалось получить курсы');
          resultPrice = (floorEth * ethPriceBnb) / bnbPrice;
          currencySymbol = 'BNB';
          break;
        case 'sol':
          // Конвертация ETH → SOL
          const solPrice = await getCryptoUsdPrices().then(prices => prices?.solana?.usd);
          const ethPriceSol = await getCryptoUsdPrices().then(prices => prices?.ethereum?.usd);
          if (!solPrice || !ethPriceSol) throw new Error('Не удалось получить курсы');
          resultPrice = (floorEth * ethPriceSol) / solPrice;
          currencySymbol = 'SOL';
          break;
        default:
          throw new Error('Неизвестная валюта');
      }
      
      // Форматируем результат
      let formattedPrice;
      if (resultPrice > 1000) {
        formattedPrice = resultPrice.toFixed(0);
      } else if (resultPrice > 1) {
        formattedPrice = resultPrice.toFixed(2);
      } else if (resultPrice > 0.01) {
        formattedPrice = resultPrice.toFixed(4);
      } else {
        formattedPrice = resultPrice.toFixed(6);
      }
      
      // Находим название коллекции
      const collection = popularNfts.find(nft => nft.contract === contract)?.name || 'NFT Collection';
      
      out.innerHTML = `
        <div class="nft-price">
          <strong>Floor: ${formattedPrice} ${currencySymbol}</strong>
        </div>
        <div class="nft-meta">
          <span>${collection}</span>
        </div>
      `;
    } catch (err) {
      console.error('Ошибка NFT:', err);
      out.innerHTML = `
        <div class="nft-error">
          Ошибка: ${err.message}
        </div>
        <div class="nft-meta">
          <span>Попробуйте другую коллекцию</span>
        </div>
      `;
      out.classList.add('error');
    }
  };
}
});
