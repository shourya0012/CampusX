import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Droplets,
  Wind,
  Gauge,
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  AlertCircle,
  Loader2,
  Thermometer,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { fetchWeather } from '../services/api.js';

const QUICK_CITIES = ['Jaipur', 'Bengaluru', 'Mumbai', 'Delhi', 'London', 'Tokyo'];
const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SEARCH_DEBOUNCE_MS = 900;
const WEATHER_SESSION_KEY = 'campusx_weather_cache_v1';

function readClientCache() {
  try {
    const raw = sessionStorage.getItem(WEATHER_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeClientCache(cacheObj) {
  try {
    sessionStorage.setItem(WEATHER_SESSION_KEY, JSON.stringify(cacheObj));
  } catch {
    // Ignore storage quota errors
  }
}

function getCachedCity(cityName) {
  const key = (cityName || '').trim().toLowerCase();
  if (!key) return null;
  const cache = readClientCache();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CLIENT_CACHE_TTL_MS) {
    return null;
  }
  return entry.data;
}

function saveCachedCity(cityName, data) {
  const key = (cityName || '').trim().toLowerCase();
  if (!key || !data) return;
  const cache = readClientCache();
  const now = Date.now();
  cache[key] = { savedAt: now, data };
  const resolvedKey = (data.city || '').trim().toLowerCase();
  if (resolvedKey && resolvedKey !== key) {
    cache[resolvedKey] = { savedAt: now, data };
  }
  cache.__lastCity = key;
  writeClientCache(cache);
}

function getLastCachedWeather() {
  const cache = readClientCache();
  const lastKey = cache.__lastCity;
  if (!lastKey) return null;
  return getCachedCity(lastKey);
}

function WeatherConditionIcon({ iconKey }) {
  const iconProps = 'h-16 w-16';
  switch (iconKey) {
    case 'clear-day':
      return <Sun className={`${iconProps} text-amber-400`} />;
    case 'clear-night':
      return <Moon className={`${iconProps} text-indigo-300`} />;
    case 'partly-cloudy-day':
      return <CloudSun className={`${iconProps} text-amber-400`} />;
    case 'partly-cloudy-night':
      return <CloudMoon className={`${iconProps} text-indigo-300`} />;
    case 'cloudy':
      return <Cloud className={`${iconProps} text-slate-400`} />;
    case 'fog':
      return <CloudFog className={`${iconProps} text-slate-400`} />;
    case 'drizzle':
      return <CloudDrizzle className={`${iconProps} text-sky-400`} />;
    case 'rain':
      return <CloudRain className={`${iconProps} text-blue-400`} />;
    case 'snow':
      return <CloudSnow className={`${iconProps} text-cyan-300`} />;
    case 'thunderstorm':
      return <CloudLightning className={`${iconProps} text-amber-400`} />;
    default:
      return <CloudSun className={`${iconProps} text-amber-400`} />;
  }
}

export default function WeatherPage() {
  const initialCached = getLastCachedWeather();
  const [city, setCity] = useState(initialCached?.city || '');
  const [weather, setWeather] = useState(initialCached);
  const [unit, setUnit] = useState('C');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);

  const inFlightKeyRef = useRef('');
  const requestSeqRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const weatherRef = useRef(weather);
  const retrySecondsRef = useRef(retrySeconds);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  useEffect(() => {
    retrySecondsRef.current = retrySeconds;
  }, [retrySeconds]);

  useEffect(() => {
    if (retrySeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setRetrySeconds((prev) => {
        if (prev <= 1) {
          setIsRateLimited(false);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retrySeconds]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const searchCity = useCallback(async (targetCity, { fromDebounce = false } = {}) => {
    const query = (targetCity ?? '').trim().replace(/\s+/g, ' ');
    if (!query) {
      if (!fromDebounce) {
        setIsRateLimited(false);
        setError('Please enter a city name before searching.');
      }
      return;
    }

    const queryKey = query.toLowerCase();

    // Serve fresh 10-minute client cache immediately with zero API calls (even during rate-limit cooldown)
    const localHit = getCachedCity(query);
    if (localHit) {
      if (!fromDebounce) {
        setCity(query);
      }
      setWeather({ ...localHit, cached: true });
      setIsRateLimited(false);
      setError('');
      return;
    }

    // Never send upstream calls while global Retry-After countdown is active
    if (retrySecondsRef.current > 0) {
      return;
    }

    // On debounce, avoid re-fetching the exact city currently displayed
    if (
      fromDebounce &&
      weatherRef.current?.city &&
      weatherRef.current.city.trim().toLowerCase() === queryKey
    ) {
      return;
    }

    // Prevent duplicate concurrent requests for the same city
    if (inFlightKeyRef.current === queryKey) {
      return;
    }

    if (!fromDebounce) {
      setCity(query);
    }

    const seq = ++requestSeqRef.current;
    inFlightKeyRef.current = queryKey;
    setLoading(true);
    setIsRateLimited(false);
    setError('');

    try {
      const data = await fetchWeather(query);
      if (seq !== requestSeqRef.current) return;
      saveCachedCity(query, data);
      setWeather(data);
      setIsRateLimited(false);
      setRetrySeconds(0);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;

      if (err?.status === 429) {
        const waitSec = Math.max(1, err.retryAfterSeconds || 60);
        setIsRateLimited(true);
        setRetrySeconds(waitSec);
        setError('');
      } else if (err?.status >= 500 || err?.status === 504) {
        setIsRateLimited(false);
        setError(
          err.message ||
            'The Open-Meteo weather service is temporarily unavailable. Please try again in a moment.'
        );
      } else {
        setIsRateLimited(false);
        setError(err?.message || 'Unable to fetch weather data right now.');
      }

      if (err?.status === 404) {
        setWeather(null);
      }
    } finally {
      if (inFlightKeyRef.current === queryKey) {
        inFlightKeyRef.current = '';
      }
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setCity(nextValue);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = nextValue.trim();
    if (trimmed.length < 3 || retrySeconds > 0) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      searchCity(trimmed, { fromDebounce: true });
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    searchCity(city);
  };

  const handleQuickCity = (preset) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    searchCity(preset);
  };

  const formatTemp = (celsius) => {
    if (unit === 'F') {
      return `${Math.round(((celsius * 9) / 5 + 32) * 10) / 10}°F`;
    }
    return `${celsius}°C`;
  };

  // Single synchronized message so banner countdown and button countdown always agree
  const displayedError =
    isRateLimited && retrySeconds > 0
      ? `Weather service is temporarily rate-limited by Open-Meteo. Please wait ${retrySeconds}s and try again.`
      : error;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Weather Dashboard
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search real-time city weather, humidity, wind speed, and conditions powered by Open-Meteo.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 p-1">
          {['C', 'F'].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                unit === u
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      {/* Search Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={city}
              onChange={handleInputChange}
              placeholder="Enter city name (e.g., Jaipur, Bengaluru, Mumbai, Delhi)..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || retrySeconds > 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-semibold shadow-md transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>
              {loading
                ? 'Searching...'
                : retrySeconds > 0
                  ? `Wait ${retrySeconds}s`
                  : 'Get Weather'}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Quick search:</span>
          {QUICK_CITIES.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={loading || (retrySeconds > 0 && !getCachedCity(preset))}
              onClick={() => handleQuickCity(preset)}
              className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-60 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </form>

      {/* Error / Rate-Limit / Availability Banner */}
      {displayedError && (
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 ${
            isRateLimited && retrySeconds > 0
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          {isRateLimited && retrySeconds > 0 ? (
            <Clock className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-medium space-y-1">
            <div>{displayedError}</div>
            {isRateLimited && retrySeconds > 0 && (
              <div className="text-xs opacity-90">
                Upstream requests are paused during cooldown ({retrySeconds}s remaining). Any previously cached cities remain available.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stale Cache Notice */}
      {weather?.stale && weather?.notice && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-300">
          {weather.notice}
        </div>
      )}

      {/* Weather Result */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-10 text-center">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Fetching live weather for {city}...
          </p>
        </div>
      ) : weather ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {weather.stale
                  ? 'Cached Fallback'
                  : weather.cached
                    ? 'Cached Weather (10m)'
                    : 'Live Weather'}{' '}
                • {weather.provider || 'Open-Meteo'}
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                {weather.city}
                {weather.region ? `, ${weather.region}` : ''}
                {weather.country ? `, ${weather.country}` : ''}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {weather.condition} • {weather.description}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <WeatherConditionIcon iconKey={weather.icon} />
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white">
                {formatTemp(weather.temperature_c)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Thermometer className="h-4 w-4 text-orange-400" />
                <span>Feels Like</span>
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {formatTemp(weather.feels_like_c)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Droplets className="h-4 w-4 text-sky-400" />
                <span>Relative Humidity</span>
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {weather.humidity}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Wind className="h-4 w-4 text-cyan-400" />
                <span>Wind Speed</span>
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {weather.wind_speed_kmh} km/h
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800/70">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Gauge className="h-4 w-4 text-indigo-400" />
                <span>Surface Pressure</span>
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {weather.pressure_hpa} hPa
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Coordinates: {weather.latitude}, {weather.longitude}
            </span>
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span>Weather data by Open-Meteo</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2">
          <CloudSun className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Search any city for live weather details
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter a city above or click a quick-search city to view temperature, relative humidity,
            wind speed, and conditions.
          </p>
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
          >
            <span>Powered by Open-Meteo</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
