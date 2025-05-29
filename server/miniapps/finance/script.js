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

// —————————————————————————————————————————————————————————
// 1) Универсальный «Обменник»
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

  const fiat = await fetch('https://api.exchangerate.host/symbols')
                    .then(r=>r.json()).then(j=>Object.keys(j.symbols));
  const coins = await fetch('https://api.coingecko.com/api/v3/coins/list')
                      .then(r=>r.json());
  // объединяем фиат + крипто
  const options = [
    ...fiat.map(c=>({ code:c,  label:c })),
    ...coins.map(c=>({ code:c.id, label:c.name }))
  ];
  for (let sel of [ 'from','to' ]) {
    const el = document.getElementById(sel);
    // сделаем простой поиск по вводу
    el.innerHTML = '';
    options.forEach(o => {
      el.add(new Option(o.label, o.code));
    });
  }
  document.getElementById('from').value = 'usd';
  document.getElementById('to'  ).value = 'bitcoin';

  document.getElementById('exchange-form')
          .addEventListener('submit', e => { e.preventDefault(); doConvert(); });
}

async function doConvert() {
  const f = document.getElementById('from').value;
  const t = document.getElementById('to'  ).value;
  const a = +document.getElementById('amount').value;
  const out = document.getElementById('exchange-result');
  if (!a || a <=0) { out.textContent='Введите корректную сумму'; return; }
  out.textContent = 'Загрузка…';

  const isFiat = c => /^[A-Z]{3}$/.test(c.toUpperCase());
  try {
    let result;
    if (isFiat(f) && isFiat(t)) {
      const j = await fetch(
        `https://api.exchangerate.host/convert?from=${f}&to=${t}&amount=${a}`
      ).then(r=>r.json());
      result = j.result;

    } else {
      // используем CoinGecko: всегда вытаскиваем цену в USD, затем считаем отношения
      const ids = [];
      if (!isFiat(f)) ids.push(f);
      if (!isFiat(t)) ids.push(t);
      const vs = 'usd';
      const j  = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${vs}`
      ).then(r=>r.json());

      // фиаты напрямую через простое отношение
      if (!isFiat(f) && !isFiat(t)) {
        const pf = j[f][vs], pt = j[t][vs];
        result = a * (pf / pt);
      }
      else if (!isFiat(f) && isFiat(t)) {
        // crypto → fiat: сначала crypto→usd, затем usd→t
        const pf = j[f][vs];
        const usd2t = await fetch(
          `https://api.exchangerate.host/convert?from=USD&to=${t}&amount=${pf * a}`
        ).then(r=>r.json()).then(x=>x.result);
        result = usd2t;
      }
      else if (isFiat(f) && !isFiat(t)) {
        // fiat → crypto: f→usd → crypto per usd, потом делим
        const usd2f = await fetch(
          `https://api.exchangerate.host/convert?from=${f}&to=USD&amount=${a}`
        ).then(r=>r.json()).then(x=>x.result);
        const pt = j[t][vs];
        result = usd2f / pt;
      }
    }

    out.innerHTML = `<strong>${a} ${f.toUpperCase()}</strong> = 
                     <strong>${result.toFixed(6)} ${t.toUpperCase()}</strong>`;
  } catch (err) {
    console.error(err);
    out.textContent = 'Ошибка при конвертации.';
  }
}

// —————————————————————————————————————————————————————————
// 2) Кошелёк (заглушка)
function showWallet() {
  content.innerHTML = `
    <h3>Кошелёк</h3>
    <p>Здесь будет баланс и история транзакций…</p>
  `;
}

// 3) Статистика (заглушка)
function showStats() {
  content.innerHTML = `
    <h3>Статистика</h3>
    <p>Графики и аналитика…</p>
  `;
}

// 4) NFT Floor Price
async function showNftFloor() {
  content.innerHTML = `
    <h3>NFT Floor Price</h3>
    <label>Contract ID: <input id="nft-contract" placeholder="bored-ape-kennel-club"></label>
    <label>В валюте <select id="nft-to">
      <option>usd</option><option>eth</option><option>btc</option>
    </select></label>
    <button id="nft-go">Показать floor</button>
    <div id="nft-result" class="exchange-result"></div>
  `;
  document.getElementById('nft-go').onclick = async () => {
    const id = document.getElementById('nft-contract').value.trim();
    const to = document.getElementById('nft-to').value;
    const out = document.getElementById('nft-result');
    if (!id) return out.textContent = 'Введите ID коллекции';
    out.textContent = 'Загрузка…';

    try {
      // используем CoinGecko NFT endpoint
      const r = await fetch(
        `https://api.coingecko.com/api/v3/nfts/${id}`
      );
      const j = await r.json();
      if (j.market_data?.floor_price) {
        const price = j.market_data.floor_price[to];
        out.innerHTML = `Floor: <strong>${price}</strong> ${to.toUpperCase()}`;
      } else {
        out.textContent = 'Не удалось получить цену.';
      }
    } catch (e) {
      console.error(e);
      out.textContent = 'Ошибка при запросе NFT.';
    }
  };
}

// запускаем по умолчанию
showExchange();
