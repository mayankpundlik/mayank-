const form = document.querySelector("#weather-form");
const input = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const searchLabel = document.querySelector("#search-label");
const message = document.querySelector("#message");
const card = document.querySelector("#weather-card");
const recentList = document.querySelector("#recent-list");
const clearRecentButton = document.querySelector("#clear-recent");

const fields = {
  icon: document.querySelector("#weather-icon"),
  location: document.querySelector("#location-name"),
  condition: document.querySelector("#condition-text"),
  temperature: document.querySelector("#temperature"),
  humidity: document.querySelector("#humidity"),
  wind: document.querySelector("#wind"),
  direction: document.querySelector("#direction"),
  updated: document.querySelector("#updated")
};

const weatherCodes = {
  0: ["Clear sky", "sun"],
  1: ["Mainly clear", "sun"],
  2: ["Partly cloudy", "cloud-sun"],
  3: ["Overcast", "cloud"],
  45: ["Fog", "cloud"],
  48: ["Depositing rime fog", "cloud"],
  51: ["Light drizzle", "rain"],
  53: ["Moderate drizzle", "rain"],
  55: ["Dense drizzle", "rain"],
  56: ["Light freezing drizzle", "rain"],
  57: ["Dense freezing drizzle", "rain"],
  61: ["Slight rain", "rain"],
  63: ["Moderate rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Light freezing rain", "rain"],
  67: ["Heavy freezing rain", "rain"],
  71: ["Slight snowfall", "snow"],
  73: ["Moderate snowfall", "snow"],
  75: ["Heavy snowfall", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Slight rain showers", "rain"],
  81: ["Moderate rain showers", "rain"],
  82: ["Violent rain showers", "rain"],
  85: ["Slight snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm with slight hail", "storm"],
  99: ["Thunderstorm with heavy hail", "storm"]
};

const recentKey = "weather-tracker-recent-cities";
let recentCities = loadRecentCities();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchWeather(input.value);
});

recentList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-city]");
  if (!button) return;
  input.value = button.dataset.city;
  searchWeather(button.dataset.city);
});

clearRecentButton.addEventListener("click", () => {
  recentCities = [];
  saveRecentCities();
  renderRecentCities();
});

renderRecentCities();
searchWeather("Indore");

async function searchWeather(rawCity) {
  const city = rawCity.trim().replace(/\s+/g, " ");

  if (!city) {
    setMessage("Please enter a city name before searching.", "error");
    input.focus();
    return;
  }

  setLoading(true);
  setMessage(`Searching weather for ${city}...`);

  try {
    const place = await findLocation(city);
    const weather = await fetchCurrentWeather(place);
    renderWeather(place, weather);
    rememberCity(place.name);
    setMessage("Weather data updated successfully.");
  } catch (error) {
    card.hidden = true;
    setMessage(error.message || "Unable to load weather right now. Please try again.", "error");
  } finally {
    setLoading(false);
  }
}

async function findLocation(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetchWithTimeout(url, 7000);
  if (!response.ok) {
    throw new Error("Location service is not responding. Please try again shortly.");
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("City not found. Check the spelling and try another city.");
  }

  return data.results[0];
}

async function fetchCurrentWeather(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", place.latitude);
  url.searchParams.set("longitude", place.longitude);
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m");
  url.searchParams.set("timezone", "auto");

  const response = await fetchWithTimeout(url, 7000);
  if (!response.ok) {
    throw new Error("Weather API failed to respond. Please try again in a moment.");
  }

  const data = await response.json();
  if (!data.current) {
    throw new Error("Weather data is unavailable for this location.");
  }

  return data.current;
}

function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  return fetch(url, { signal: controller.signal })
    .catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("The request took too long. Please check your connection and try again.");
      }
      throw new Error("Network connection failed. Please check your internet and try again.");
    })
    .finally(() => clearTimeout(timer));
}

function renderWeather(place, weather) {
  const [description, iconName] = weatherCodes[weather.weather_code] || ["Weather data available", "cloud"];
  const region = [place.admin1, place.country].filter(Boolean).join(", ");

  fields.icon.innerHTML = getWeatherIcon(iconName);
  fields.location.textContent = `${place.name}${region ? `, ${region}` : ""}`;
  fields.condition.textContent = description;
  fields.temperature.textContent = Math.round(weather.temperature_2m);
  fields.humidity.textContent = `${weather.relative_humidity_2m}%`;
  fields.wind.textContent = `${Math.round(weather.wind_speed_10m)} km/h`;
  fields.direction.textContent = getCompassDirection(weather.wind_direction_10m);
  fields.updated.textContent = formatTime(weather.time);
  card.hidden = false;
}

function setMessage(text, type = "info") {
  message.textContent = text;
  message.classList.toggle("error", type === "error");
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchLabel.textContent = isLoading ? "Loading..." : "Search";
}

function rememberCity(city) {
  recentCities = [city, ...recentCities.filter((item) => item.toLowerCase() !== city.toLowerCase())].slice(0, 6);
  saveRecentCities();
  renderRecentCities();
}

function loadRecentCities() {
  try {
    return JSON.parse(localStorage.getItem(recentKey)) || [];
  } catch {
    return [];
  }
}

function saveRecentCities() {
  localStorage.setItem(recentKey, JSON.stringify(recentCities));
}

function renderRecentCities() {
  clearRecentButton.hidden = recentCities.length === 0;
  recentList.innerHTML = recentCities.length
    ? recentCities.map((city) => `<button class="recent-city" type="button" data-city="${escapeAttribute(city)}">${escapeText(city)}</button>`).join("")
    : `<p class="message">Searched cities will appear here.</p>`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function getCompassDirection(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function escapeText(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function escapeAttribute(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function getWeatherIcon(name) {
  const icons = {
    sun: `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="15" fill="#f4b63f" stroke="#c98216"></circle><path d="M40 5v12M40 63v12M5 40h12M63 40h12M15 15l9 9M56 56l9 9M65 15l-9 9M24 56l-9 9" stroke="#c98216"></path></svg>`,
    "cloud-sun": `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="28" cy="27" r="13" fill="#f4b63f" stroke="#c98216"></circle><path d="M28 4v9M28 41v9M5 27h9M42 27h9M12 11l7 7M37 36l7 7M44 11l-7 7" stroke="#c98216"></path><path d="M24 60h34a13 13 0 0 0 0-26 18 18 0 0 0-34-5 16 16 0 0 0 0 31Z" fill="#fff" stroke="#6d8792"></path></svg>`,
    cloud: `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20 57h39a15 15 0 0 0 0-30 21 21 0 0 0-40-5 18 18 0 0 0 1 35Z" fill="#fff" stroke="#6d8792"></path></svg>`,
    rain: `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20 48h39a15 15 0 0 0 0-30 21 21 0 0 0-40-5 18 18 0 0 0 1 35Z" fill="#fff" stroke="#6d8792"></path><path d="M26 58l-5 12M41 58l-5 12M56 58l-5 12" stroke="#4d8ecf"></path></svg>`,
    snow: `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20 45h39a15 15 0 0 0 0-30 21 21 0 0 0-40-5 18 18 0 0 0 1 35Z" fill="#fff" stroke="#6d8792"></path><path d="M27 58v12M21 64h12M42 58v12M36 64h12M57 58v12M51 64h12" stroke="#4d8ecf"></path></svg>`,
    storm: `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20 45h39a15 15 0 0 0 0-30 21 21 0 0 0-40-5 18 18 0 0 0 1 35Z" fill="#fff" stroke="#6d8792"></path><path d="m40 49-8 15h10l-4 12 13-18H40l7-9Z" fill="#f4b63f" stroke="#c98216"></path></svg>`
  };

  return icons[name] || icons.cloud;
}
