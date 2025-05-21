const inputGroup     = document.getElementById('input-group');
const changeCityBtn  = document.getElementById('change-city');
const getWeatherBtn  = document.getElementById('get-weather');
const cityInput      = document.getElementById('city');

window.addEventListener('load', () => {
  // Пробуем геолокацию
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => showCityInput()
    );
  } else {
    showCityInput();
  }
});

getWeatherBtn.addEventListener('click', () => {
  const city = cityInput.value.trim();
  if (!city) return;
  fetchWeather({ city });
});

changeCityBtn.addEventListener('click', () => {
  showCityInput(true);
});

function showCityInput(showButtonAfter = false) {
  inputGroup.style.display = 'flex';
  changeCityBtn.style.display = showButtonAfter ? 'none' : 'none';
}

function fetchWeather({ city, lat, lon }) {
  // Скрываем ввод
  inputGroup.style.display = 'none';
  changeCityBtn.style.display = 'block';

  let query;
  if (city) {
    query = encodeURIComponent(city);
  } else {
    query = `${lat},${lon}`;
  }

  const url = `https://wttr.in/${query}?format=j1&lang=ru`;
  fetch(url)
    .then(res => res.json())
    .then(data => renderWeather(data))
    .catch(err => {
      document.querySelector('#current .content').innerText = 'Ошибка загрузки';
      console.error(err);
    });
}

function renderWeather(data) {
  const current = data.current_condition[0];
  const today   = data.weather[0];
  const week    = data.weather;

  // Секция «Сейчас»
  const place = data.nearest_area?.[0]?.areaName?.[0]?.value || '';
  document.querySelector('#current .content').innerHTML = `
    <div>${place}</div>
    <div>${current.temp_C}°C, ${current.weatherDesc[0].value}</div>
    <div>Ощущается как ${current.FeelsLikeC}°C</div>
    <div>Влажность ${current.humidity}%</div>
  `;

  // «Сегодня» по часам (первые 8 часов)
  const hourlyContainer = document.querySelector('.forecast-hourly');
  hourlyContainer.innerHTML = '';
  today.hourly.slice(0, 8).forEach((h, i) => {
    const hour = (new Date().getHours() + i) % 24;
    const el = document.createElement('div');
    el.className = 'hour';
    el.innerHTML = `
      <span>${hour}:00</span>
      <span class="temp">${h.tempC}°</span>
      <span>${h.weatherDesc[0].value}</span>
    `;
    hourlyContainer.append(el);
  });

  // «На неделю»
  const weeklyContainer = document.querySelector('.forecast-weekly');
  weeklyContainer.innerHTML = '';
  week.forEach(day => {
    const el = document.createElement('div');
    el.className = 'day';
    el.innerHTML = `
      <span>${day.date.slice(5)}</span>
      <span class="temp">↑${day.maxtempC}° ↓${day.mintempC}°</span>
      <span>${day.hourly[4].weatherDesc[0].value}</span>
    `;
    weeklyContainer.append(el);
  });
}
