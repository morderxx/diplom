document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('finance-content');
  const tabs    = document.querySelectorAll('.finance-nav button');

  // Фиатные коды и карта крипто→ID CoinGecko
  const fiatCodes = ['USD','EUR','RUB','GBP','JPY','CNY'];
  const cryptoMap = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    LTC: 'litecoin',
    DOGE: 'dogecoin',
    BNB: 'binancecoin',
    USDT:'tether',
    XRP: 'ripple',
    ADA: 'cardano',
    SOL: 'solana',
    DOT: 'polkadot',
    AVAX:'avalanche',
    MATIC:'matic-network'
  };

  // Повесим табы
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'exchange') showExchange();
      else if (tab === 'wallet')  showWallet();
      else if (tab === 'stats')   showStats();
      else if (tab === 'nft')     showNftFloor();
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
    const selTo   = document.getElementById('to');
    selFrom.innerHTML = selTo.innerHTML = '';

    // Фиаты
    fiatCodes.forEach(c => {
      selFrom.add(new Option(c, c));
      selTo  .add(new Option(c, c));
    });
    // Крипта
    Object.keys(cryptoMap).forEach(c => {
      selFrom.add(new Option(c, c));
      selTo  .add(new Option(c, c));
    });

    selFrom.value = 'USD';
    selTo.value   = 'BTC';

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

  if (!a || a <= 0) return out.textContent = 'Введите корректную сумму';
  out.textContent = 'Загрузка…';

  const fiatCodes = ['USD', 'EUR', 'RUB', 'GBP', 'JPY', 'CNY'];
  const cryptoMap = {
    BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', DOGE: 'dogecoin',
    BNB: 'binancecoin', USDT: 'tether', XRP: 'ripple', ADA: 'cardano',
    SOL: 'solana', DOT: 'polkadot', AVAX: 'avalanche', MATIC: 'matic-network'
  };
  const isFiat = c => fiatCodes.includes(c);
  const isCrypto = c => Object.keys(cryptoMap).includes(c);

  const getFiatToUsd = async (code, amount) => {
    const j = await fetch(`https://api.exchangerate.host/convert?from=${code}&to=USD&amount=${amount}`)
      .then(r => r.json());
    return j?.result ?? NaN;
  };

  const getUsdToFiat = async (code, amount) => {
    const j = await fetch(`https://api.exchangerate.host/convert?from=USD&to=${code}&amount=${amount}`)
      .then(r => r.json());
    return j?.result ?? NaN;
  };

  const getCryptoToUsd = async (code, amount) => {
    const id = cryptoMap[code];
    const j = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
      .then(r => r.json());
    const rate = j?.[id]?.usd;
    return rate ? amount * rate : NaN;
  };

  const getUsdToCrypto = async (code, amount) => {
    const id = cryptoMap[code];
    const j = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
      .then(r => r.json());
    const rate = j?.[id]?.usd;
    return rate ? amount / rate : NaN;
  };

  try {
    let usdAmount = NaN;
    if (f === 'USD') usdAmount = a;
    else if (isFiat(f)) usdAmount = await getFiatToUsd(f, a);
    else if (isCrypto(f)) usdAmount = await getCryptoToUsd(f, a);
    else throw new Error('Неверный код валюты: ' + f);

    if (!isFinite(usdAmount)) throw new Error('Не удалось получить курс для ' + f);

    let final = NaN;
    if (t === 'USD') final = usdAmount;
    else if (isFiat(t)) final = await getUsdToFiat(t, usdAmount);
    else if (isCrypto(t)) final = await getUsdToCrypto(t, usdAmount);
    else throw new Error('Неверный код валюты: ' + t);

    if (!isFinite(final)) throw new Error('Не удалось получить курс для ' + t);

    out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${final.toFixed(6)} ${t}</strong>`;
  } catch (e) {
    console.error(e);
    out.textContent = 'Ошибка при конвертации.';
  }
}



  // ——— Прочие табы ——————————————————————————
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
        ).then(r=>r.json());
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
