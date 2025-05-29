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
  const a = parseFloat(document.getElementById('amount').value);
  const out = document.getElementById('exchange-result');
  if (!a || a <= 0) {
    return out.textContent = 'Введите корректную сумму';
  }
  out.textContent = 'Загрузка…';

  // Ваши списки
  const fiatCodes = ['USD','EUR','RUB','GBP','JPY','CNY'];
  const cryptoMap = {
    BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', DOGE: 'dogecoin',
    BNB: 'binancecoin', USDT:'tether', XRP: 'ripple', ADA: 'cardano',
    SOL: 'solana', DOT: 'polkadot', AVAX:'avalanche', MATIC:'matic-network'
  };
  const isFiat   = code => fiatCodes.includes(code);
  const isCrypto = code => Object.keys(cryptoMap).includes(code);

  try {
    // 1) любое f → USD
    let usdAmount;
    if (f === 'USD') {
      usdAmount = a;
    }
    else if (isFiat(f)) {
      const j = await fetch(
        `https://api.exchangerate.host/convert?from=${f}&to=USD&amount=${a}`
      ).then(r => r.json());
      usdAmount = j.result;
    }
    else if (isCrypto(f)) {
      const idF = cryptoMap[f];
      const data = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idF}&vs_currencies=usd`
      ).then(r => r.json());
      usdAmount = a * (data[idF]?.usd || 0);
    } else {
      throw new Error('Неизвестная валюта: ' + f);
    }

    // 2) USD → любое t
    let final;
    if (t === 'USD') {
      final = usdAmount;
    }
    else if (isFiat(t)) {
      const j2 = await fetch(
        `https://api.exchangerate.host/convert?from=USD&to=${t}&amount=${usdAmount}`
      ).then(r => r.json());
      final = j2.result;
    }
    else if (isCrypto(t)) {
      const idT = cryptoMap[t];
      const data2 = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idT}&vs_currencies=usd`
      ).then(r => r.json());
      const rate = data2[idT]?.usd;
      final = rate ? usdAmount / rate : NaN;
    } else {
      throw new Error('Неизвестная валюта: ' + t);
    }

    if (!isFinite(final)) throw new Error('Непростая конвертация');

    out.innerHTML = `<strong>${a} ${f}</strong> = <strong>${final.toFixed(6)} ${t}</strong>`;
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
