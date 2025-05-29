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
    usd: 'US Dollar', eur: 'Euro', rub: 'Russian Ruble', gbp: 'British Pound',
    jpy: 'Japanese Yen', cny: 'Chinese Yuan',
    btc: 'Bitcoin', eth: 'Ethereum', ltc: 'Litecoin', doge: 'Dogecoin',
    bnb: 'Binance Coin', usdt: 'Tether', xrp: 'Ripple',
    sol: 'Solana', ada: 'Cardano', dot: 'Polkadot', avax: 'Avalanche', ton: 'Toncoin'
  };

  const fiatSet = new Set(['usd','eur','rub','gbp','jpy','cny']);
  const fromSel = document.getElementById('from-currency');
  const toSel   = document.getElementById('to-currency');

  // Заполняем селекты
  for (let code in currencies) {
    const opt1 = new Option(`${code.toUpperCase()} — ${currencies[code]}`, code);
    const opt2 = opt1.cloneNode(true);
    fromSel.add(opt1);
    toSel.add(opt2);
  }
  fromSel.value = 'usd';
  toSel.value   = 'btc';

  document.getElementById('exchange-form').addEventListener('submit', async e => {
    e.preventDefault();
    const from = fromSel.value, to = toSel.value;
    const amount = parseFloat(document.getElementById('amount').value);
    const out = document.getElementById('exchange-result');
    if (isNaN(amount) || amount<=0) {
      out.textContent = 'Введите корректную сумму';
      return;
    }
    out.textContent = 'Загрузка…';

    try {
      let result;

      // оба фиата
      if (fiatSet.has(from) && fiatSet.has(to)) {
        const res = await fetch(`https://api.exchangerate.host/convert?from=${from.toUpperCase()}&to=${to.toUpperCase()}&amount=${amount}`);
        const data = await res.json();
        result = data.result;

      // оба крипто
      } else if (!fiatSet.has(from) && !fiatSet.has(to)) {
        // получаем стоимость обоих в USD
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${from},${to}&vs_currencies=usd`);
        const data = await res.json();
        const rateFrom = data[from]?.usd;
        const rateTo   = data[to]?.usd;
        if (!rateFrom || !rateTo) throw new Error();
        result = amount * (rateTo / rateFrom);

      // crypto → fiat
      } else if (!fiatSet.has(from) && fiatSet.has(to)) {
        // Coingecko умеет сразу отдавать в фиат
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${from}&vs_currencies=${to}`);
        const data = await res.json();
        const rate = data[from]?.[to];
        if (!rate) throw new Error();
        result = amount * rate;

      // fiat → crypto
      } else { // fiatSet.has(from) && !fiatSet.has(to)
        // получаем стоимость crypto в цене фиата, затем делим
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${to}&vs_currencies=${from}`);
        const data = await res.json();
        const rate = data[to]?.[from];
        if (!rate) throw new Error();
        result = amount / rate;
      }

      out.innerHTML = `<strong>${amount} ${from.toUpperCase()}</strong> = <strong>${result.toFixed(6)} ${to.toUpperCase()}</strong>`;

    } catch (_) {
      out.textContent = 'Ошибка при конвертации.';
    }
  });
}

showExchange();



showExchange(); // загрузка по умолчанию
