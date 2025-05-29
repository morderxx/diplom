document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('finance-content');
  const tabs    = document.querySelectorAll('.finance-nav button');

  // Поддерживаемые фиатные коды и маппинг крипты→ID CoinGecko
  const fiatCodes = ['USD','EUR','RUB','GBP','JPY','CNY'];
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

  // Вешаем переключение вкладок
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

  // === 1) Функция показа обменника ===
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

    // наполняем фиатными
    fiatCodes.forEach(c => {
      selFrom.add(new Option(c, c));
      selTo  .add(new Option(c, c));
    });
    // криптовалютой
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

  // === 2) Функция конвертации ===
  async function doConvert() {
    const f = document.getElementById('from').value.toUpperCase();
    const t = document.getElementById('to'  ).value.toUpperCase();
    const a = parseFloat(document.getElementById('amount').value);
    const out = document.getElementById('exchange-result');

    if (!a || a <= 0) {
      out.textContent = 'Введите корректную сумму';
      return;
    }
    out.textContent = 'Загрузка…';

    const isFiat   = c => fiatCodes.includes(c);
    const isCrypto = c => Object.keys(cryptoMap).includes(c);

    try {
      let rate;

      // 1) Фиат → фиат (используем exchangerate.host)
      if (isFiat(f) && isFiat(t)) {
        const j = await fetch(
          `https://api.exchangerate.host/convert?from=${f}&to=${t}&amount=${a}`
        ).then(r => r.json());
        rate = j.result;
      }
      // 2) Крипто → крипто (через USD как мост)
      else if (isCrypto(f) && isCrypto(t)) {
        const idF = cryptoMap[f];
        const idT = cryptoMap[t];
        const pj = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idF},${idT}&vs_currencies=usd`
        ).then(r => r.json());
        const usdF = pj[idF]?.usd;
        const usdT = pj[idT]?.usd;
        if (!usdF || !usdT) throw new Error();
        rate = a * (usdF / usdT);
      }
      // 3) Crypto → Fiаt (CoinGecko simple price, vs_currencies=fiat)
      else if (isCrypto(f) && isFiat(t)) {
        const idF = cryptoMap[f];
        const pj = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idF}&vs_currencies=${t.toLowerCase()}`
        ).then(r => r.json());
        rate = pj[idF]?.[t.toLowerCase()] * a;
      }
      // 4) Fiat → Crypto (CoinGecko simple price, vs_currencies=fiat, а затем делим)
      else if (isFiat(f) && isCrypto(t)) {
        const idT = cryptoMap[t];
        const pj = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idT}&vs_currencies=${f.toLowerCase()}`
        ).then(r => r.json());
        const price = pj[idT]?.[f.toLowerCase()];
        if (!price) throw new Error();
        rate = a / price;
      }
      else {
        throw new Error('Неподдерживаемая пара');
      }

      if (!isFinite(rate)) throw new Error();
      out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${rate.toFixed(6)} ${t}</strong>`;
    } catch {
      out.textContent = 'Ошибка при конвертации.';
    }
  }

  // === Заглушки для других вкладок ===
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
        <label>Contract ID <input id="nft-contract" placeholder="bored-ape-kennel-club"></label>
        <label>В валюте 
          <select id="nft-to">
            <option value="usd">USD</option>
            <option value="eth">ETH</option>
            <option value="btc">BTC</option>
          </select>
        </label>
        <button>Показать floor</button>
      </form>
      <div id="nft-result" class="exchange-result"></div>
    `;
    document.getElementById('nft-form').onsubmit = async e => {
      e.preventDefault();
      const id  = document.getElementById('nft-contract').value.trim();
      const toV = document.getElementById('nft-to').value.toLowerCase();
      const out = document.getElementById('nft-result');
      if (!id) return out.textContent = 'Введите ID коллекции';
      out.textContent = 'Загрузка…';
      try {
        const j = await fetch(`https://api.coingecko.com/api/v3/nfts/${id}`)
                      .then(r => r.json());
        const price = j.market_data?.floor_price?.[toV];
        out.innerHTML = price
          ? `Floor: <strong>${price}</strong> ${toV.toUpperCase()}`
          : 'Не удалось получить цену.';
      } catch {
        out.textContent = 'Ошибка при запросе NFT.';
      }
    };
  }
});
