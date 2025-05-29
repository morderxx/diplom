document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('finance-content');
  const tabs = document.querySelectorAll('.finance-nav button');

  // Фиатные коды и карта крипто→ID CoinGecko
  const fiatCodes = ['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD'];
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

  // API ключ для CurrencyFreaks (бесплатный)
  const CURRENCY_API_KEY = '24f59325463e418ca66aee20d46a0925'; // Замените на свой ключ

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
      .addEventListener('submit', e => {
        e.preventDefault();
        doConvert();
      });
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

    const isFiat = c => fiatCodes.includes(c);
    const isCrypto = c => Object.keys(cryptoMap).includes(c);

    try {
      let result;

      // 1) Fiat → Fiat через CurrencyFreaks
      if (isFiat(f) && isFiat(t)) {
        const j = await fetch(
          `https://api.currencyfreaks.com/latest?apikey=${CURRENCY_API_KEY}&symbols=${f},${t}`
        ).then(r => r.json());
        
        if (!j.rates || !j.rates[f] || !j.rates[t]) throw new Error();
        // Конвертация через USD как базовую валюту
        const rateFrom = j.rates[f];
        const rateTo = j.rates[t];
        result = a * (rateTo / rateFrom);
      }

      // 2) Crypto → Crypto
      else if (isCrypto(f) && isCrypto(t)) {
        const idF = cryptoMap[f], idT = cryptoMap[t];
        const pj = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idF},${idT}&vs_currencies=usd`
        ).then(r => r.json());
        const usdF = pj[idF]?.usd, usdT = pj[idT]?.usd;
        if (!usdF || !usdT) throw new Error();
        result = a * (usdF / usdT);
      }

      // 3) Crypto → Fiat
      else if (isCrypto(f) && isFiat(t)) {
        const idF = cryptoMap[f];
        const pj = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idF}&vs_currencies=${t.toLowerCase()}`
        ).then(r => r.json());
        const rate = pj[idF]?.[t.toLowerCase()];
        if (rate == null) throw new Error();
        result = a * rate;
      }

      // 4) Fiat → Crypto
      else if (isFiat(f) && isCrypto(t)) {
        const idT = cryptoMap[t];
        const pj = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idT}&vs_currencies=${f.toLowerCase()}`
        ).then(r => r.json());
        const rate = pj[idT]?.[f.toLowerCase()];
        if (!rate) throw new Error();
        result = a / rate;
      }

      else {
        throw new Error('Unsupported pair');
      }

      if (!isFinite(result)) throw new Error();
      out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${result.toFixed(6)} ${t}</strong>`;
    } catch (err) {
      console.error(err);
      out.textContent = 'Ошибка при конвертации.';
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
      if (!id) return out.textContent = 'Введите ID коллекции';
      out.textContent = 'Загрузка…';
      try {
        const j = await fetch(
          `https://api.coingecko.com/api/v3/nfts/${id}`
        ).then(r => r.json());
        const price = j.market_data?.floor_price?.[to];
        out.innerHTML = price
          ? `Floor: <strong>${price}</strong> ${to.toUpperCase()}`
          : 'Не удалось получить цену.';
      } catch {
        out.textContent = 'Ошибка при запросе NFT.';
      }
    };
  }
});
