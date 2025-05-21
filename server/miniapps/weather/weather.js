document.getElementById("get-weather").addEventListener("click", () => {
  const city = document.getElementById("city").value.trim();
  if (!city) return;

  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  fetch(url)
    .then(res => res.json())
    .then(data => renderWeather(data, city))
    .catch(err => {
      document.querySelector("#current .content").innerText = "Ошибка загрузки";
      console.error(err);
    });
});

function renderWeather(data, city) {
  const current = data.current_condition[0];
  const today = data.weather[0];
  const week  = data.weather;

  // 1) Секция «Сейчас»
  document.querySelector("#current .content").innerHTML = `
    <div>${city}</div>
    <div>${current.temp_C}°C</div>
    <div>${current.weatherDesc[0].value}</div>
    <div>Влажность: ${current.humidity}%</div>
  `;

  // 2) Секция «Сегодня» по часам (первые 8 часов)
  const hourlyContainer = document.querySelector(".forecast-hourly");
  hourlyContainer.innerHTML = "";
  today.hourly.slice(0, 8).forEach(h => {
    const hour = new Date().getHours() + today.hourly.indexOf(h);
    const el = document.createElement("div");
    el.className = "hour";
    el.innerHTML = `
      <span>${hour % 24}:00</span>
      <span class="temp">${h.tempC}°</span>
      <span>${h.weatherDesc[0].value}</span>
    `;
    hourlyContainer.append(el);
  });

  // 3) Секция «На неделю»
  const weeklyContainer = document.querySelector(".forecast-weekly");
  weeklyContainer.innerHTML = "";
  week.forEach(day => {
    const el = document.createElement("div");
    el.className = "day";
    el.innerHTML = `
      <span>${day.date.substring(5)}</span>
      <span class="temp">↑${day.maxtempC}°↓${day.mintempC}°</span>
      <span>${day.hourly[4].weatherDesc[0].value}</span>
    `;
    weeklyContainer.append(el);
  });
}
