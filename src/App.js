import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Calendar, TrendingUp, Users, DollarSign, AlertCircle, LogOut, Cloud, RefreshCw, Key } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import {
  API_CONFIG,
  VENUES,
  STORAGE_KEYS,
  loginToBookedIt,
  isTokenValid,
  getValidToken,
  fetchBookingsFromAPI,
  clearStoredCredentials
} from './api-config.js';

const GOOGLE_CLIENT_ID = '774728510184-cbmd5chb33iq3r89r51pnmkmpsont4u4.apps.googleusercontent.com';
const ALLOWED_DOMAIN = '@thefayreplay.co.uk';

// Venue coordinates for weather API
const VENUE_COORDINATES = {
  glasgow: { lat: 55.8642, lon: -4.2518, name: 'Glasgow' },
  edinburgh: { lat: 55.9533, lon: -3.1883, name: 'Edinburgh' },
  newcastle: { lat: 54.9783, lon: -1.6178, name: 'Newcastle' }
};

// Venue capacity limits
const VENUE_CAPACITIES = {
  glasgow: 475,
  edinburgh: 450,
  newcastle: 450
};

// Weather multipliers
const WEATHER_MULTIPLIERS = {
  thu: {
    rainfall: {
      noRain: 1.00,
      lightRain: 1.19,
      moderateRain: 1.35,
      heavyRain: 1.29,
      veryHeavyRain: 1.82
    },
    temperature: {
      mild: 1.00,
      warm: 1.62,
      hot: 1.47
    }
  },
  fri: {
    rainfall: {
      noRain: 1.00,
      lightRain: 0.85,
      moderateRain: 1.06,
      heavyRain: 0.89,
      veryHeavyRain: 1.08
    },
    temperature: {
      mild: 1.00,
      warm: 1.23,
      hot: 1.15,
      veryHot: 0.90
    }
  },
  sat: {
    rainfall: {
      noRain: 1.00
    },
    temperature: {}
  },
  sun: {
    rainfall: {
      noRain: 1.00,
      lightRain: 0.80,
      moderateRain: 0.75,
      heavyRain: 0.5,
      veryHeavyRain: 0.2
    },
    temperature: {
      mild: 1.00,
      warm: 0.32,
      hot: 0.26,
      veryHot: 0.34
    }
  }
};

// Venue-specific multipliers
const VENUE_MULTIPLIERS = {
  glasgow: {
    0: { day14: 8.81, day7: 4.55, day3: 2.36, day1: 1.63 },
    1: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    2: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    3: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    4: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    5: { day14: 4.54, day7: 3.02, day3: 1.97, day1: 1.43 },
    6: { day14: 6.85, day7: 3.25, day3: 1.95, day1: 1.43 }
  },
  edinburgh: {
    0: { day14: 8.37, day7: 5.14, day3: 2.99, day1: 2.08 },
    1: { day14: 6.66, day7: 4.40, day3: 3.73, day1: 2.34 },
    2: { day14: 6.66, day7: 4.40, day3: 3.73, day1: 2.34 },
    3: { day14: 6.66, day7: 3.40, day3: 3.73, day1: 2.34 },
    4: { day14: 9.42, day7: 3.87, day3: 3.08, day1: 2.76 },
    5: { day14: 5.58, day7: 3.71, day3: 2.10, day1: 1.73 },
    6: { day14: 3.93, day7: 2.59, day3: 1.89, day1: 1.56 }
  },
  newcastle: {
    0: { day14: 8.81, day7: 4.55, day3: 2.36, day1: 1.63 },
    1: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    2: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    3: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    4: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    5: { day14: 4.54, day7: 3.02, day3: 1.97, day1: 1.43 },
    6: { day14: 6.85, day7: 3.25, day3: 1.95, day1: 1.43 }
  }
};

const classifyRainfall = (precipitationMM) => {
  if (precipitationMM === 0) return 'noRain';
  if (precipitationMM <= 2) return 'lightRain';
  if (precipitationMM <= 5) return 'moderateRain';
  if (precipitationMM <= 10) return 'heavyRain';
  return 'veryHeavyRain';
};

const getWeatherMultiplier = (dayName, rainfallMM, temperatureCelsius) => {
  const day = dayName.toLowerCase();
  
  if (!WEATHER_MULTIPLIERS[day]) return 1.0;
  
  const dayData = WEATHER_MULTIPLIERS[day];
  
  if (day === 'saturday') return 1.0;
  
  const rainfallCondition = classifyRainfall(rainfallMM);
  let rainfallMult = dayData.rainfall[rainfallCondition] || 1.0;
  
  let tempMult = 1.0;
  if (temperatureCelsius < 5) {
    tempMult = dayData.temperature.mild || 1.0;
  } else if (temperatureCelsius <= 15) {
    tempMult = dayData.temperature.mild || 1.0;
  } else if (temperatureCelsius <= 20) {
    tempMult = dayData.temperature.warm || 1.0;
  } else if (temperatureCelsius <= 25) {
    tempMult = dayData.temperature.hot || 1.0;
  } else {
    tempMult = dayData.temperature.veryHot || dayData.temperature.hot || 1.0;
  }
  
  return rainfallMult * tempMult;
};

const fetchWeatherData = async (daysFromNow = 14, venue = 'glasgow') => {
  try {
    const venueCoords = VENUE_COORDINATES[venue] || VENUE_COORDINATES.glasgow;
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysFromNow);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.append('latitude', venueCoords.lat);
    url.searchParams.append('longitude', venueCoords.lon);
    url.searchParams.append('daily', 'precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code');
    url.searchParams.append('timezone', 'Europe/London');
    url.searchParams.append('forecast_days', 16);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const weatherLookup = {};
    if (data.daily && data.daily.time) {
      for (let i = 0; i < data.daily.time.length; i++) {
        const date = data.daily.time[i];
        weatherLookup[date] = {
          precipitation_mm: data.daily.precipitation_sum[i] || 0,
          temp_max: data.daily.temperature_2m_max[i] || 15,
          temp_min: data.daily.temperature_2m_min[i] || 10,
          weather_code: data.daily.weather_code ? data.daily.weather_code[i] : null
        };
      }
    }
    
    return weatherLookup;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};

const getMondayOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  
  let daysToSubtract;
  if (day === 0) {
    daysToSubtract = 6;
  } else if (day === 1) {
    daysToSubtract = 0;
  } else {
    daysToSubtract = day - 1;
  }
  
  d.setDate(d.getDate() - daysToSubtract);
  return d;
};

const getDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Glasgow14DayForecast = () => {
  const HOURLY_RATE = 12.60;
  const MANAGER_WEEKLY_COST = 596.15;

  const getRevenuePerCover = (dayOfWeek) => {
    const revenueByVenue = {
      glasgow: {
        0: 26.74, 1: 25.70, 2: 25.70, 3: 25.70, 4: 25.70, 5: 27.72, 6: 27.59
      },
      edinburgh: {
        0: 24.90, 1: 22.50, 2: 22.50, 3: 23.50, 4: 24.50, 5: 27.80, 6: 28.20
      },
      newcastle: {
        0: 26.74, 1: 25.70, 2: 25.70, 3: 25.70, 4: 25.70, 5: 27.72, 6: 27.59
      }
    };
    
    return revenueByVenue[venue]?.[dayOfWeek] || 25.00;
  };

  const [user, setUser] = useState(null);
  const [venue, setVenue] = useState('glasgow');
  const [forecasts, setForecasts] = useState([]);
  const [error, setError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [showWeatherInfo, setShowWeatherInfo] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherLastUpdated, setWeatherLastUpdated] = useState(null);
  
  // API login state
  const [apiEmail, setApiEmail] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [apiLoggedIn, setApiLoggedIn] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  let minimumDailyBudgets;
  if (venue === 'edinburgh') {
    minimumDailyBudgets = {
      0: 700, 1: 131, 2: 131, 3: 600, 4: 500, 5: 800, 6: 1000
    };
  } else if (venue === 'newcastle') {
    minimumDailyBudgets = {
      0: 1000, 1: 750, 2: 750, 3: 750, 4: 750, 5: 1000, 6: 1600
    };
  } else {
    minimumDailyBudgets = {
      0: 700, 1: 131, 2: 131, 3: 200, 4: 500, 5: 800, 6: 1000
    };
  }

  const forecastMultipliers = VENUE_MULTIPLIERS[venue] || VENUE_MULTIPLIERS.glasgow;

  let staffHoursTemplates;
  if (venue === 'edinburgh') {
    staffHoursTemplates = {
      0: { baseHours: 40, perCover: 0.11 },
      1: { baseHours: 0, perCover: 0 },
      2: { baseHours: 0, perCover: 0 },
      3: { baseHours: 25, perCover: 0.05 },
      4: { baseHours: 25, perCover: 0.05 },
      5: { baseHours: 40, perCover: 0.16 },
      6: { baseHours: 80, perCover: 0.16 }
    };
  } else if (venue === 'newcastle') {
    staffHoursTemplates = {
      0: { baseHours: 40, perCover: 0.11 },
      1: { baseHours: 25, perCover: 0.05 },
      2: { baseHours: 25, perCover: 0.05 },
      3: { baseHours: 25, perCover: 0.05 },
      4: { baseHours: 25, perCover: 0.05 },
      5: { baseHours: 40, perCover: 0.16 },
      6: { baseHours: 80, perCover: 0.16 }
    };
  } else {
    staffHoursTemplates = {
      0: { baseHours: 40, perCover: 0.11 },
      1: { baseHours: 0, perCover: 0 },
      2: { baseHours: 0, perCover: 0 },
      3: { baseHours: 0, perCover: 0 },
      4: { baseHours: 25, perCover: 0.05 },
      5: { baseHours: 40, perCover: 0.16 },
      6: { baseHours: 80, perCover: 0.16 }
    };
  }

  const calculateMultiplier = (dayOfWeek, daysUntil) => {
    const multipliers = forecastMultipliers[dayOfWeek];
    if (daysUntil >= 14) return multipliers.day14;
    if (daysUntil >= 7) return multipliers.day7;
    if (daysUntil >= 3) return multipliers.day3;
    if (daysUntil >= 1) return multipliers.day1;
    return multipliers.day1;
  };

  const calculateStaffHours = (dayOfWeek, covers) => {
    const template = staffHoursTemplates[dayOfWeek];
    if (template.baseHours === 0) return 0;
    const hours = Math.round(template.baseHours + (covers * template.perCover));
    return hours + 3;
  };

  // ========================================================================
  // GOOGLE LOGIN
  // ========================================================================

  const handleLoginSuccess = (credentialResponse) => {
    try {
      const token = credentialResponse.credential;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const userData = JSON.parse(jsonPayload);
      
      if (userData.email && userData.email.endsWith(ALLOWED_DOMAIN)) {
        setUser(userData);
        setLoginError(null);
        sessionStorage.setItem('glasgowForecastUser', JSON.stringify(userData));
      } else {
        setLoginError(`Access denied. Only ${ALLOWED_DOMAIN} emails are allowed.`);
      }
    } catch (err) {
      setLoginError('Login failed. Please try again.');
    }
  };

  const handleLoginError = () => {
    setLoginError('Login failed. Please try again.');
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('glasgowForecastUser');
    setForecasts([]);
    setWeatherData(null);
    handleApiLogout();
  };

  React.useEffect(() => {
    const storedUser = sessionStorage.getItem('glasgowForecastUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // ========================================================================
  // API LOGIN & BOOKINGS FETCHING
  // ========================================================================

  const handleApiLogin = async (e) => {
    e.preventDefault();
    setApiError(null);
    setLoadingBookings(true);

    try {
      // Login to Booked.it API
      await loginToBookedIt(apiEmail, apiPassword);
      setApiLoggedIn(true);
      setApiPassword(''); // Clear password from state
      
      // Immediately fetch bookings
      await fetchBookingsFromVenue();
    } catch (err) {
      setApiError(err.message);
      setApiLoggedIn(false);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleApiLogout = () => {
    clearStoredCredentials();
    setApiLoggedIn(false);
    setApiEmail('');
    setApiPassword('');
    setForecasts([]);
    setWeatherData(null);
  };

  const fetchBookingsFromVenue = async () => {
    setLoadingBookings(true);
    setError(null);

    try {
      const token = await getValidToken(apiEmail, apiPassword);
      const venueId = VENUES[venue].id;

      // Fetch next 14 days
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);

      const bookings = await fetchBookingsFromAPI(venueId, token, today, endDate);

      // Process bookings into forecast format
      await processBookingsToForecast(bookings);
      setLastRefreshed(new Date());

    } catch (err) {
      setError(err.message);
      // If token expired, reset login
      if (err.message.includes('Unauthorized')) {
        setApiLoggedIn(false);
      }
    } finally {
      setLoadingBookings(false);
    }
  };

  const processBookingsToForecast = async (bookings) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mondayThisWeek = getMondayOfWeek(today);
      const sundayThisWeek = new Date(mondayThisWeek);
      sundayThisWeek.setDate(sundayThisWeek.getDate() + 6);
      sundayThisWeek.setHours(23, 59, 59, 999);

      const mondayNextWeek = new Date(mondayThisWeek);
      mondayNextWeek.setDate(mondayNextWeek.getDate() + 7);
      const sundayNextWeek = new Date(mondayNextWeek);
      sundayNextWeek.setDate(sundayNextWeek.getDate() + 6);
      sundayNextWeek.setHours(23, 59, 59, 999);

      const bookingsByDate = {};

      // Group bookings by date
      bookings.forEach(booking => {
        // Parse event date (assuming ISO format from API)
        const eventDate = new Date(booking.date_time || booking.event_date);
        
        if (isNaN(eventDate.getTime())) return;

        // Filter by date range
        if (eventDate < mondayThisWeek || eventDate > sundayNextWeek) {
          return;
        }

        const groupDate = new Date(eventDate);
        groupDate.setHours(0, 0, 0, 0);
        const dateKey = getDateString(groupDate);

        if (!bookingsByDate[dateKey]) {
          bookingsByDate[dateKey] = {
            date: new Date(groupDate),
            bookingCount: 0,
            covers: 0,
            bookingHours: []
          };
        }

        bookingsByDate[dateKey].bookingCount++;
        bookingsByDate[dateKey].covers += (booking.number_of_people || booking.people || 0);
        bookingsByDate[dateKey].bookingHours.push(eventDate.getHours());
      });

      const parsedData = [];

      for (const dateKey in bookingsByDate) {
        const data = bookingsByDate[dateKey];
        const eventDate = data.date;

        const daysUntil = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntil >= -6 && daysUntil <= 13) {
          const dayOfWeek = eventDate.getDay();

          const isPastDate = eventDate < today;
          let multiplier = 1.0;
          let forecastCovers = data.covers;

          if (!isPastDate) {
            multiplier = calculateMultiplier(dayOfWeek, daysUntil);
            forecastCovers = Math.round(data.covers * multiplier);
          }

          let isPotentialPrivateFunction = false;

          if (daysUntil > 0 && venue !== 'newcastle') {
            let normallyClosedDays = [1, 2, 3];
            if (venue === 'edinburgh') {
              normallyClosedDays = [1, 2];
            }
            const isNormallyClosed = normallyClosedDays.includes(dayOfWeek);
            isPotentialPrivateFunction = isNormallyClosed;
          }

          const currentCovers = data.covers;

          if (isPotentialPrivateFunction) {
            multiplier = 1.0;
            forecastCovers = currentCovers;
          }

          const venueCapacity = VENUE_CAPACITIES[venue];
          const wasCapped = forecastCovers > venueCapacity;
          if (venueCapacity && forecastCovers > venueCapacity) {
            forecastCovers = venueCapacity;
          }

          const staffHours = calculateStaffHours(dayOfWeek, forecastCovers);
          const revenuePerCover = getRevenuePerCover(dayOfWeek);

          const revenue = isPotentialPrivateFunction
            ? (currentCovers * revenuePerCover)
            : (forecastCovers * revenuePerCover);

          const laborCost = staffHours * HOURLY_RATE;
          const laborPct = revenue > 0 ? (laborCost / revenue * 100) : 0;

          const minimumBudget = minimumDailyBudgets[dayOfWeek];
          const budgetRequired = Math.max(laborCost, minimumBudget);

          const isPast = eventDate < today;

          parsedData.push({
            date: eventDate,
            dateStr: eventDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
            dayOfWeek,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
            daysUntil,
            currentBookings: data.bookingCount,
            currentCovers: currentCovers,
            multiplier: multiplier,
            forecastCovers,
            staffHours,
            revenue,
            laborCost,
            laborPct,
            budgetRequired,
            minimumBudget,
            isClosed: staffHours === 0 && !isPotentialPrivateFunction,
            isPotentialPrivateFunction,
            isPast: isPast,
            weatherMultiplier: 1.0,
            weatherInfo: null,
            wasCapped,
            venueCapacity
          });
        }
      }

      if (parsedData.length === 0) {
        setError('No bookings found for the next 14 days');
        return;
      }

      parsedData.sort((a, b) => a.date - b.date);
      setForecasts(parsedData);

      // Fetch weather data
      await handleAutoFetchWeather();

    } catch (err) {
      setError(`Error processing bookings: ${err.message}`);
    }
  };

  const handleAutoFetchWeather = async () => {
    setLoadingWeather(true);
    const weather = await fetchWeatherData(14, venue);

    if (weather) {
      setWeatherData(weather);
      setWeatherLastUpdated(new Date());

      const updatedForecasts = forecasts.map(day => {
        const dateKey = getDateString(day.date);
        const weatherInfo = weather[dateKey];

        if (weatherInfo) {
          let weatherMult = 1.0;
          let weatherAdjustedCovers = day.forecastCovers;

          if (!day.isPotentialPrivateFunction && !day.isClosed) {
            weatherMult = getWeatherMultiplier(day.dayName, weatherInfo.precipitation_mm, weatherInfo.temp_max);

            const additionalCovers = Math.max(0, day.forecastCovers - day.currentCovers);
            const weatherAdjustedAdditional = Math.round(additionalCovers * weatherMult);
            weatherAdjustedCovers = day.currentCovers + weatherAdjustedAdditional;
          }

          return {
            ...day,
            weatherMultiplier: weatherMult,
            weatherInfo: weatherInfo,
            forecastCoversWithWeather: weatherAdjustedCovers,
            laborCostWithWeather: weatherAdjustedCovers * (day.laborCost / day.forecastCovers || HOURLY_RATE),
            revenueWithWeather: weatherAdjustedCovers * (day.revenue / day.forecastCovers || 0)
          };
        }

        return day;
      });

      setForecasts(updatedForecasts);
      setShowWeatherInfo(true);
    }

    setLoadingWeather(false);
  };

  const handleRefreshWeather = async () => {
    await handleAutoFetchWeather();
  };

  // ... (rest of the component continues with weeklySummaries calculation and UI)
  // This would include all the existing forecast display logic

  // ========================================================================
  // UI RENDER
  // ========================================================================

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Calendar size={48} className="mx-auto mb-4 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Glasgow Forecast</h1>
            <p className="text-gray-600 mt-2">14-Day Staffing and Revenue Forecast</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {loginError}
            </div>
          )}

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
            />
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Access restricted to @thefayreplay.co.uk
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          <Calendar size={32} />
          <div>
            <h1 className="text-3xl font-bold">{VENUE_COORDINATES[venue].name} 14-Day Staffing Forecast</h1>
            <p className="text-indigo-100">API-Powered | Real-Time Booking Data</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Venue:</label>
            <select
              value={venue}
              onChange={(e) => {
                setVenue(e.target.value);
                setForecasts([]);
                setWeatherData(null);
              }}
              className="bg-white bg-opacity-20 text-white border border-white rounded px-3 py-2 text-sm font-medium hover:bg-opacity-30 transition"
            >
              <option value="glasgow" className="text-gray-800">Glasgow</option>
              <option value="edinburgh" className="text-gray-800">Edinburgh</option>
              <option value="newcastle" className="text-gray-800">Newcastle</option>
            </select>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* API Login Section */}
      {!apiLoggedIn ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-8 text-center mb-6">
          <Key size={48} className="mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold mb-2">Connect to Booked.it API</h3>
          <p className="text-sm text-gray-600 mb-6">
            Enter your Booked.it credentials to fetch live booking data
          </p>

          <form onSubmit={handleApiLogin} className="max-w-sm mx-auto">
            <div className="mb-4">
              <input
                type="email"
                placeholder="your_email@thefayreplay.co.uk"
                value={apiEmail}
                onChange={(e) => setApiEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-6">
              <input
                type="password"
                placeholder="Your Booked.it password"
                value={apiPassword}
                onChange={(e) => setApiPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {apiError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingBookings}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loadingBookings ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Key size={18} />
                  Login & Fetch Bookings
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-left text-xs text-gray-600">
            <p className="font-semibold mb-2">📝 Booked.it API Info:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>Use your Booked.it login email and password</li>
              <li>Data fetches for the next 14 days automatically</li>
              <li>Refreshes whenever you change venue or reload</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Logged In - Show Bookings & Controls */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex justify-between items-center">
            <div>
              <p className="text-sm text-blue-900 font-semibold">✓ Connected to Booked.it API</p>
              <p className="text-xs text-blue-700">Venue: {VENUES[venue].name}</p>
              {lastRefreshed && (
                <p className="text-xs text-blue-700 mt-1">Last updated: {lastRefreshed.toLocaleTimeString()}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchBookingsFromVenue}
                disabled={loadingBookings}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2 text-sm"
              >
                <RefreshCw size={16} className={loadingBookings ? 'animate-spin' : ''} />
                {loadingBookings ? 'Refreshing...' : 'Refresh Now'}
              </button>
              <button
                onClick={handleApiLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition text-sm"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-4 flex items-start gap-2">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Forecasts display */}
          {forecasts.length > 0 ? (
            <div>
              <h2 className="text-2xl font-bold mb-4">Forecast Ready</h2>
              <p className="text-gray-700 mb-6">Loaded {forecasts.length} days of booking data</p>
              {/* Forecast tables would go here - same as existing version */}
            </div>
          ) : loadingBookings ? (
            <div className="text-center py-12">
              <RefreshCw size={48} className="mx-auto animate-spin text-blue-600 mb-4" />
              <p className="text-gray-700">Fetching bookings from Booked.it...</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

const ProtectedGlasgowForecast = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Glasgow14DayForecast />
    </GoogleOAuthProvider>
  );
};

export default ProtectedGlasgowForecast;
