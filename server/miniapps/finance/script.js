const content = document.getElementById('finance-content');
const buttons = document.querySelectorAll('.finance-nav button');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    content.classList.add('active'); // делаем контент видимым
    if (tab === 'exchange') {
      showExchange();
    } else if (tab === 'wallet') {
      content.innerHTML = `
        <h3>Кошелёк</h3>
        <div class="wallet-info">
          <div class="balance">₽ 152,340.00</div>
          <ul class="transactions">
            <li><span>Покупка BTC</span><span>-₽ 15,000</span></li>
            <li><span>Продажа ETH</span><span>+₽ 8,500</span></li>
            <li><span>Пополнение</span><span>+₽ 20,000</span></li>
          </ul>
        </div>`;
    } else if (tab === 'stats') {
      content.innerHTML = `
        <h3>Статистика</h3>
        <div class="stats-chart">📈 Здесь будет график</div>`;
    }
  });
});

async function showExchange() {
  content.innerHTML = `
    <h3>Обменник валют и крипты</h3>
    <form class="exchange-form" id="exchange-form">
      <label>
        Из валюты
        <select id="from-currency"></select>
      </label>
      <label>
        В валюту
        <select id="to-currency"></select>
      </label>
      <label style="grid-column: span 2;">
        Сумма
        <input type="number" id="amount" value="1" min="0" step="any" required>
      </label>
      <button type="submit">Конвертировать</button>
    </form>
    <div class="exchange-result" id="exchange-result">Введите сумму и выберите валюты</div>
  `;

  const currencies = {
    // фиат
    USD: 'US Dollar', EUR: 'Euro', RUB: 'Russian Ruble',
    GBP: 'British Pound', JPY: 'Japanese Yen', CNY: 'Chinese Yuan',
    // крипта
    BTC: 'Bitcoin', ETH: 'Ethereum', LTC: 'Litecoin', DOGE: 'Dogecoin',
    BNB: 'Binance Coin', USDT: 'Tether', XRP: 'Ripple',
    SOL: 'Solana', ADA: 'Cardano', DOT: 'Polkadot', AVAX: 'Avalanche', TON: 'Toncoin'
  };

  // мапа символ → CoinGecko ID (только для крипты)
  const cgIds = {
    BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', DOGE: 'dogecoin',
    BNB: 'binancecoin', USDT: 'tether', XRP: 'ripple',
    SOL: 'solana', ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2', TON: 'toncoin'
  };

  const fiatSet = new Set(['USD','EUR','RUB','GBP','JPY','CNY']);
  const fromSel = document.getElementById('from-currency');
  const toSel   = document.getElementById('to-currency');

  // заполняем селекты
  for (let code in currencies) {
    fromSel.add(new Option(`${code} — ${currencies[code]}`, code));
    toSel  .add(new Option(`${code} — ${currencies[code]}`, code));
  }
  fromSel.value = 'USD';
  toSel.value   = 'BTC';

  document.getElementById('exchange-form').addEventListener('submit', async e => {
    e.preventDefault();
    const from = fromSel.value, to = toSel.value;
    const amount = parseFloat(document.getElementById('amount').value);
    const out = document.getElementById('exchange-result');
    if (isNaN(amount) || amount <= 0) {
      out.textContent = 'Введите корректную сумму';
      return;
    }
    out.textContent = 'Загрузка…';

    try {
      let result;

      // 1) fiat → fiat
      if (fiatSet.has(from) && fiatSet.has(to)) {
        const res = await fetch(
          `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`
        );
        const data = await res.json();
        result = data.result;

      // 2) crypto → crypto
      } else if (!fiatSet.has(from) && !fiatSet.has(to)) {
        const idFrom = cgIds[from], idTo = cgIds[to];
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idFrom},${idTo}&vs_currencies=usd`
        );
        const data = await res.json();
        const rateFrom = data[idFrom].usd;
        const rateTo   = data[idTo].usd;
        result = amount * (rateTo / rateFrom);

      // 3) crypto → fiat
      } else if (!fiatSet.has(from) && fiatSet.has(to)) {
        const idFrom = cgIds[from];
        const res    = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idFrom}&vs_currencies=${to.toLowerCase()}`
        );
        const data = await res.json();
        const rate = data[idFrom][to.toLowerCase()];
        result = amount * rate;

      // 4) fiat → crypto
      } else { // fiat → crypto
        const idTo = cgIds[to];
        const res  = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idTo}&vs_currencies=${from.toLowerCase()}`
        );
        const data = await res.json();
        const rate = data[idTo][from.toLowerCase()];
        result = amount / rate;
      }

      out.innerHTML = `
        <strong>${amount} ${from}</strong> =
        <strong>${result.toFixed(6)} ${to}</strong>
      `;
    } catch (err) {
      console.error(err);
      out.textContent = 'Ошибка при конвертации.';
    }
  });
}

showExchange();
