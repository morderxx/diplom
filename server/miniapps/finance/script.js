// script.js
const content = document.getElementById('finance-content');
const tabs    = document.querySelectorAll('.finance-nav button');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'exchange') showExchange();
    else if (tab === 'wallet')   showWallet();
    else if (tab === 'stats')    showStats();
    else if (tab === 'nft')      showNftFloor();
  });
});

// ————————————————————————————————————————————————
// Универсальный обменник
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

  // 1) загрузим фиатные
  const fiatResp = await fetch('https://api.exchangerate.host/symbols');
  const fiatJson = await fiatResp.json();
  const fiats    = Object.keys(fiatJson.symbols);

  // 2) загрузим крипту
  const coinsResp = await fetch('https://api.coingecko.com/api/v3/coins/list');
  const coinsList = await coinsResp.json();

  // 3) объединим
  const options = [
    ...fiats.map(c => ({ code: c, label: c })),
    ...coinsList.map(c=>({ code: c.id, label: c.name }))
  ];

  const selFrom = document.getElementById('from');
  const selTo   = document.getElementById('to');
  options.forEach(o => {
    selFrom.add(new Option(o.label, o.code));
    selTo  .add(new Option(o.label, o.code));
  });

  selFrom.value = 'usd';
  selTo  .value = 'bitcoin';

  document.getElementById('exchange-form')
    .addEventListener('submit', e => { e.preventDefault(); doConvert(); });
}

async function doConvert() {
  const f = document.getElementById('from').value;
  const t = document.getElementById('to'  ).value;
  const a = +document.getElementById('amount').value;
  const out = document.getElementById('exchange-result');
  if (!a || a <= 0) return out.textContent = 'Введите корректную сумму';
  out.textContent = 'Загрузка…';

  const isFiat = c => /^[A-Z]{3}$/.test(c.toUpperCase());
  try {
    let result;
    if (isFiat(f) && isFiat(t)) {
      // фиат → фиат
      const j = await fetch(
        `https://api.exchangerate.host/convert?from=${f}&to=${t}&amount=${a}`
      ).then(r=>r.json());
      result = j.result;
    } else {
      // крипто или смешанный
      // 1) получаем цены крипто в USD
      const ids = [];
      if (!isFiat(f)) ids.push(f);
      if (!isFiat(t)) ids.push(t);
      const cg = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
      ).then(r=>r.json());

      if (!isFiat(f) && !isFiat(t)) {
        // crypto → crypto
        result = a * (cg[f].usd / cg[t].usd);
      } else if (!isFiat(f) && isFiat(t)) {
        // crypto → fiat: сначала crypto→USD, потом USD→t
        const inUsd = a * cg[f].usd;
        result = (await fetch(
          `https://api.exchangerate.host/convert?from=USD&to=${t}&amount=${inUsd}`
        ).then(r=>r.json())).result;
      } else { // fiat → crypto
        const usdAmount = (await fetch(
          `https://api.exchangerate.host/convert?from=${f}&to=USD&amount=${a}`
        ).then(r=>r.json())).result;
        result = usdAmount / cg[t].usd;
      }
    }

    out.innerHTML = `<strong>${a} ${f.toUpperCase()}</strong> = 
                     <strong>${result.toFixed(6)} ${t.toUpperCase()}</strong>`;
  } catch {
    out.textContent = 'Ошибка при конвертации.';
  }
}

// Заглушки
function showWallet() {
  content.innerHTML = `<h3>Кошелёк</h3><p>Баланс и история транзакций…</p>`;
}
function showStats() {
  content.innerHTML = `<h3>Статистика</h3><p>Графики и аналитика…</p>`;
}

// NFT floor
function showNftFloor() {
  content.innerHTML = `
    <h3>NFT Floor Price</h3>
    <form class="nft-form" id="nft-form">
      <label>
        Contract ID
        <input id="nft-contract" placeholder="bored-ape-kennel-club">
      </label>
      <label>
        В валюте
        <select id="nft-to">
          <option value="usd">USD</option>
          <option value="eth">ETH</option>
          <option value="btc">BTC</option>
        </select>
      </label>
      <button type="submit">Показать floor</button>
    </form>
    <div id="nft-result" class="exchange-result"></div>
  `;

  document.getElementById('nft-form').onsubmit = async e => {
    e.preventDefault();
    const id = document.getElementById('nft-contract').value.trim();
    const to = document.getElementById('nft-to').value;
    const out = document.getElementById('nft-result');
    if (!id) return out.textContent = 'Введите ID коллекции';
    out.textContent = 'Загрузка…';
    try {
      const j = await fetch(`https://api.coingecko.com/api/v3/nfts/${id}`).then(r=>r.json());
      const price = j.market_data?.floor_price?.[to];
      out.innerHTML = price
        ? `Floor: <strong>${price}</strong> ${to.toUpperCase()}`
        : 'Не удалось получить цену.';
    } catch {
      out.textContent = 'Ошибка при запросе NFT.';
    }
  };
}


// старт
showExchange();
