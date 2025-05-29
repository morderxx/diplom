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
    const t = document.getElementById('to'  ).value.toUpperCase();
    const a = +document.getElementById('amount').value;
    const out = document.getElementById('exchange-result');
    if (!a || a <= 0) return out.textContent = 'Введите корректную сумму';
    out.textContent = 'Загрузка…';

    const isFiat   = c => fiatCodes.includes(c);
    const isCrypto = c => Object.keys(cryptoMap).includes(c);

    try {
      let result;

      // 1) Фиат → Фиат
      if (isFiat(f) && isFiat(t)) {
        const { result: r } = await fetch(
          `https://api.exchangerate.host/convert?from=${f}&to=${t}&amount=${a}`
        ).then(r=>r.json());
        result = r;

      // 2) Крипто вовсю
      } else {
        // получаем курс крипто→USD
        let cryptoRates = {};
        // если в запросе участвует хотя бы одна крипта
        if (isCrypto(f) || isCrypto(t)) {
          const ids = [];
          if (isCrypto(f)) ids.push( cryptoMap[f] );
          if (isCrypto(t)) ids.push( cryptoMap[t] );
          cryptoRates = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
          ).then(r=>r.json());
        }

        if (isCrypto(f) && isCrypto(t)) {
          // crypto→crypto: amount * (f→USD) / (t→USD)
          const usdF = cryptoRates[ cryptoMap[f] ].usd;
          const usdT = cryptoRates[ cryptoMap[t] ].usd;
          result = a * (usdF / usdT);

        } else if (isCrypto(f) && isFiat(t)) {
          // crypto→fiat: f→USD затем USD→t
          const inUsd = a * cryptoRates[ cryptoMap[f] ].usd;
          const { result: r } = await fetch(
            `https://api.exchangerate.host/convert?from=USD&to=${t}&amount=${inUsd}`
          ).then(r=>r.json());
          result = r;

        } else if (isFiat(f) && isCrypto(t)) {
          // fiat→crypto: f→USD затем USD / (t→USD)
          const { result: usdAmt } = await fetch(
            `https://api.exchangerate.host/convert?from=${f}&to=USD&amount=${a}`
          ).then(r=>r.json());
          const usdT = cryptoRates[ cryptoMap[t] ].usd;
          result = usdAmt / usdT;
        }
      }

      out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${result.toFixed(6)} ${t}</strong>`;
    } catch (err) {
      console.error(err);
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
