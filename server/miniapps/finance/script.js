document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('finance-content');
  const tabs    = document.querySelectorAll('.finance-nav button');

  // 1) Списки
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

  // вешаем табы
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

  // 2) Конвертер
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
    // очистка
    selFrom.innerHTML = selTo.innerHTML = '';
    // заполним фиаты
    fiatCodes.forEach(c => {
      selFrom.add(new Option(c, c));
      selTo  .add(new Option(c, c));
    });
    // и крипту
    Object.entries(cryptoMap).forEach(([code, id]) => {
      selFrom.add(new Option(code, code));
      selTo  .add(new Option(code, code));
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

    const isFiat = code => fiatCodes.includes(code);
    const isCrypto = code => Object.keys(cryptoMap).includes(code);

    try {
      let result;
      // фиат → фиат
      if (isFiat(f) && isFiat(t)) {
        const j = await fetch(
          `https://api.exchangerate.host/convert?from=${f}&to=${t}&amount=${a}`
        ).then(r => r.json());
        result = j.result;
      } else {
        // определяем id для CoinGecko
        const fromId = isCrypto(f) ? cryptoMap[f] : null;
        const toId   = isCrypto(t) ? cryptoMap[t] : null;
        // если оба крипто или смешанный, запросим CoinGecko simple/price
        // vs_currencies может быть фиат или crypto id -> всегда lowercase
        const vs = [];
        if (isFiat(t)) vs.push(t.toLowerCase());
        if (isCrypto(t)) vs.push(toId);
        // получаем цену `f` в `vs`
        let priceData;
        if (isCrypto(f)) {
          priceData = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${fromId}&vs_currencies=${vs.join(',')}`
          ).then(r => r.json());
        } else {
          // если f — фиат, а t — крипто, надо получить crypto→fiat rate
          priceData = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${toId}&vs_currencies=${f.toLowerCase()}`
          ).then(r => r.json());
        }
        if (isCrypto(f) && isCrypto(t)) {
          // crypto→crypto: amount * (f→usd)/(t→usd)
          const usd1 = priceData[fromId].usd;
          const usd2 = priceData[fromId][vs[1]]; // если vs[1] exists: toId
          // но проще: два запроса:
          const fUsd = priceData[fromId].usd;
          const tUsd = (await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${toId}&vs_currencies=usd`
          ).then(r=>r.json()))[toId].usd;
          result = a * (fUsd / tUsd);
        } else if (isCrypto(f) && isFiat(t)) {
          // crypto→fiat: amount * (f→t)
          result = a * priceData[fromId][t.toLowerCase()];
        } else if (isFiat(f) && isCrypto(t)) {
          // fiat→crypto: amount / (t→f)
          const rate = priceData[toId][f.toLowerCase()];
          result = a / rate;
        }
      }
      out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${result.toFixed(6)} ${t}</strong>`;
    } catch (err) {
      console.error(err);
      out.textContent = 'Ошибка при конвертации.';
    }
  }

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

  // стартовая вкладка
  showExchange();
});
