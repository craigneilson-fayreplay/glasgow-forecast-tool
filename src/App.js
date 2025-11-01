import React, { useState, useMemo, useEffect } from 'react';
import { LogOut, Cloud, RefreshCw, Calendar, AlertCircle, Loader } from 'lucide-react';

// ============================================================================
// API CONFIGURATION
// ============================================================================

const BOOKED_API_BASE = 'https://api.booked.it/api';

const VENUES = {
  glasgow: { id: 226, name: 'Glasgow', capacity: 475 },
  edinburgh: { id: 227, name: 'Edinburgh', capacity: 450 },
  newcastle: { id: 225, name: 'Newcastle', capacity: 450 }
};

// ============================================================================
// VENUE CAPACITY LIMITS & MULTIPLIERS (from existing version)
// ============================================================================

const VENUE_CAPACITIES = {
  glasgow: 475,
  edinburgh: 450,
  newcastle: 450
};

const WEATHER_MULTIPLIERS = {
  thu: {
    rainfall: {
      noRain: 1.00, lightRain: 1.19, moderateRain: 1.35, heavyRain: 1.29, veryHeavyRain: 1.82
    },
    temperature: { mild: 1.00, warm: 1.62, hot: 1.47 }
  },
  fri: {
    rainfall: {
      noRain: 1.00, lightRain: 0.85, moderateRain: 1.06, heavyRain: 0.89, veryHeavyRain: 1.08
    },
    temperature: { mild: 1.00, warm: 1.23, hot: 1.15, veryHot: 0.90 }
  },
  sat: { rainfall: { noRain: 1.00 }, temperature: {} },
  sun: {
    rainfall: {
      noRain: 1.00, lightRain: 0.80, moderateRain: 0.75, heavyRain: 0.5, veryHeavyRain: 0.2
    },
    temperature: { mild: 1.00, warm: 0.32, hot: 0.26, veryHot: 0.34 }
  }
};

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
  if (day === 'sat') return 1.0;
  
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

const fetchWeatherData = async (daysFromNow = 14, venueName = 'glasgow') => {
  try {
    const venueCoords = {
      glasgow: { lat: 55.8642, lon: -4.2518 },
      edinburgh: { lat: 55.9533, lon: -3.1883 },
      newcastle: { lat: 54.9783, lon: -1.6178 }
    }[venueName];

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
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    
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

// ============================================================================
// BOOKED.IT API FUNCTIONS
// ============================================================================

const loginToBookedIt = async (email, password) => {
  try {
    const response = await fetch(
      `${BOOKED_API_BASE}/v1/user/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error('Login failed. Check your credentials.');
    }

    const data = await response.json();
    return data.data.token; // Bearer token
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

const fetchBookedItOrders = async (token, providerId) => {
  try {
    const response = await fetch(
      `${BOOKED_API_BASE}/v1/order/dashboard/order?provider_id=${providerId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GlasgowForecastAppAPI = () => {
  const HOURLY_RATE = 12.60;
  const MANAGER_WEEKLY_COST = 596.15;

  const getRevenuePerCover = (dayOfWeek, venueName) => {
    const revenueByVenue = {
      glasgow: { 0: 26.74, 1: 25.70, 2: 25.70, 3: 25.70, 4: 25.70, 5: 27.72, 6: 27.59 },
      edinburgh: { 0: 24.90, 1: 22.50, 2: 22.50, 3: 23.50, 4: 24.50, 5: 27.80, 6: 28.20 },
      newcastle: { 0: 26.74, 1: 25.70, 2: 25.70, 3: 25.70, 4: 25.70, 5: 27.72, 6: 27.59 }
    };
    
    return revenueByVenue[venueName]?.[dayOfWeek] || 25.00;
  };

  const getStaffHoursTemplate = (dayOfWeek, venueName) => {
    const templates = {
      glasgow: {
        0: { baseHours: 40, perCover: 0.11 },
        1: { baseHours: 0, perCover: 0 },
        2: { baseHours: 0, perCover: 0 },
        3: { baseHours: 0, perCover: 0 },
        4: { baseHours: 25, perCover: 0.05 },
        5: { baseHours: 40, perCover: 0.16 },
        6: { baseHours: 80, perCover: 0.16 }
      },
      edinburgh: {
        0: { baseHours: 40, perCover: 0.11 },
        1: { baseHours: 0, perCover: 0 },
        2: { baseHours: 0, perCover: 0 },
        3: { baseHours: 25, perCover: 0.05 },
        4: { baseHours: 25, perCover: 0.05 },
        5: { baseHours: 40, perCover: 0.16 },
        6: { baseHours: 80, perCover: 0.16 }
      },
      newcastle: {
        0: { baseHours: 40, perCover: 0.11 },
        1: { baseHours: 25, perCover: 0.05 },
        2: { baseHours: 25, perCover: 0.05 },
        3: { baseHours: 25, perCover: 0.05 },
        4: { baseHours: 25, perCover: 0.05 },
        5: { baseHours: 40, perCover: 0.16 },
        6: { baseHours: 80, perCover: 0.16 }
      }
    };
    return templates[venueName]?.[dayOfWeek] || { baseHours: 0, perCover: 0 };
  };

  const getMinimumDailyBudgets = (venueName) => {
    const budgets = {
      glasgow: { 0: 700, 1: 131, 2: 131, 3: 200, 4: 500, 5: 800, 6: 1000 },
      edinburgh: { 0: 700, 1: 131, 2: 131, 3: 600, 4: 500, 5: 800, 6: 1000 },
      newcastle: { 0: 1000, 1: 750, 2: 750, 3: 750, 4: 750, 5: 1000, 6: 1600 }
    };
    return budgets[venueName] || budgets.glasgow;
  };

  // STATE
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [venue, setVenue] = useState('glasgow');
  const [forecasts, setForecasts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLastUpdated, setWeatherLastUpdated] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [showWeatherInfo, setShowWeatherInfo] = useState(true);

  // LOGIN HANDLER
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const bearerToken = await loginToBookedIt(loginEmail, loginPassword);
      setToken(bearerToken);
      setUser({ email: loginEmail });
      
      // Store in session
      sessionStorage.setItem('bookedToken', bearerToken);
      sessionStorage.setItem('bookedEmail', loginEmail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // FETCH FORECASTS FROM API
  const handleFetchForecasts = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const providerId = VENUES[venue].id;
      const orders = await fetchBookedItOrders(token, providerId);

      // Process orders into daily forecasts
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookingsByDate = {};

      orders.forEach(order => {
        if (!order.start_date || order.status !== 'active') return;

        // Parse date from order
        const dateParts = order.start_date.split('T')[0].split('-');
        const timeParts = order.start_date.split('T')[1]?.split(':') || [0, 0, 0];
        
        const eventDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2]),
          parseInt(timeParts[0]),
          parseInt(timeParts[1]),
          parseInt(timeParts[2])
        );

        if (isNaN(eventDate.getTime())) return;

        const dateKey = getDateString(eventDate);
        const people = order.customer?.expected_guests || 1;

        if (!bookingsByDate[dateKey]) {
          bookingsByDate[dateKey] = {
            date: new Date(eventDate),
            bookingCount: 0,
            covers: 0,
            bookingHours: []
          };
        }

        bookingsByDate[dateKey].bookingCount++;
        bookingsByDate[dateKey].covers += people;
        bookingsByDate[dateKey].bookingHours.push(eventDate.getHours());
      });

      // Calculate forecasts
      const forecastMultipliers = VENUE_MULTIPLIERS[venue];
      const minimumBudgets = getMinimumDailyBudgets(venue);
      const parsedData = [];

      for (const dateKey in bookingsByDate) {
        const data = bookingsByDate[dateKey];
        const eventDate = data.date;
        const daysUntil = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntil >= -6 && daysUntil <= 13) {
          const dayOfWeek = eventDate.getDay();
          
          let multiplier = 1.0;
          let forecastCovers = data.covers;

          if (daysUntil > 0) {
            const multipliers = forecastMultipliers[dayOfWeek];
            if (daysUntil >= 14) multiplier = multipliers.day14;
            else if (daysUntil >= 7) multiplier = multipliers.day7;
            else if (daysUntil >= 3) multiplier = multipliers.day3;
            else multiplier = multipliers.day1;

            forecastCovers = Math.round(data.covers * multiplier);
          }

          // Check if capacity exceeded
          const venueCapacity = VENUE_CAPACITIES[venue];
          let wasCapped = false;
          if (venueCapacity && forecastCovers > venueCapacity) {
            wasCapped = true;
            forecastCovers = venueCapacity;
          }

          // Calculate staffing
          const template = getStaffHoursTemplate(dayOfWeek, venue);
          const staffHours = template.baseHours === 0 ? 0 : Math.round(template.baseHours + (forecastCovers * template.perCover)) + 3;

          // Calculate revenue
          const revenuePerCover = getRevenuePerCover(dayOfWeek, venue);
          const revenue = forecastCovers * revenuePerCover;

          // Calculate labor
          const laborCost = staffHours * HOURLY_RATE;
          const laborPct = revenue > 0 ? (laborCost / revenue * 100) : 0;

          const minimumBudget = minimumBudgets[dayOfWeek];
          const budgetRequired = Math.max(laborCost, minimumBudget);

          parsedData.push({
            date: eventDate,
            dateStr: eventDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
            dayOfWeek,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
            daysUntil,
            currentBookings: data.bookingCount,
            currentCovers: data.covers,
            multiplier: multiplier,
            forecastCovers,
            staffHours,
            revenue,
            laborCost,
            laborPct,
            budgetRequired,
            minimumBudget,
            isClosed: staffHours === 0,
            isPast: eventDate < today,
            weatherMultiplier: 1.0,
            weatherInfo: null,
            wasCapped,
            venueCapacity
          });
        }
      }

      if (parsedData.length === 0) {
        setError('No bookings found for the next 14 days');
        setForecasts([]);
      } else {
        parsedData.sort((a, b) => a.date - b.date);
        setForecasts(parsedData);
        
        // Auto-fetch weather
        await handleAutoFetchWeather(parsedData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // WEATHER HANDLER
  const handleAutoFetchWeather = async (forecastData = forecasts) => {
    setLoadingWeather(true);
    const weather = await fetchWeatherData(14, venue);

    if (weather) {
      setWeatherData(weather);
      setWeatherLastUpdated(new Date());

      const updatedForecasts = forecastData.map(day => {
        const dateKey = getDateString(day.date);
        const weatherInfo = weather[dateKey];

        if (weatherInfo) {
          let weatherMult = 1.0;
          let weatherAdjustedCovers = day.forecastCovers;

          if (!day.isClosed) {
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

  // LOGOUT HANDLER
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setForecasts([]);
    setWeatherData(null);
    sessionStorage.removeItem('bookedToken');
    sessionStorage.removeItem('bookedEmail');
  };

  // Restore session on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('bookedToken');
    const storedEmail = sessionStorage.getItem('bookedEmail');
    if (storedToken && storedEmail) {
      setToken(storedToken);
      setUser({ email: storedEmail });
    }
  }, []);

  // UI HELPERS
  const getStatusColor = (pct) => {
    if (pct === 0) return 'text-gray-400 bg-gray-100';
    if (pct <= 25) return 'text-green-700 bg-green-100';
    if (pct <= 30) return 'text-amber-700 bg-amber-100';
    return 'text-red-700 bg-red-100';
  };

  const getConfidenceColor = (daysUntil) => {
    if (daysUntil <= 2) return 'bg-green-100 text-green-800';
    if (daysUntil <= 6) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceLabel = (daysUntil) => {
    if (daysUntil <= 2) return 'High';
    if (daysUntil <= 6) return 'Medium';
    return 'Low';
  };

  // Weekly summaries
  const weeklySummaries = useMemo(() => {
    if (forecasts.length === 0) return [];

    const weeks = [];
    let currentWeek = [];
    let weekStartDate = null;

    forecasts.forEach((day, idx) => {
      const dayOfWeek = day.date.getDay();

      if (dayOfWeek === 1 || idx === 0) {
        if (currentWeek.length > 0) {
          weeks.push({ weekOf: weekStartDate, days: currentWeek });
        }
        currentWeek = [];
        weekStartDate = day.dateStr;
      }

      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      weeks.push({ weekOf: weekStartDate, days: currentWeek });
    }

    return weeks.map(week => {
      const operatingDays = week.days.filter(d => !d.isClosed);
      const totalCovers = operatingDays.reduce((sum, d) => sum + (d.forecastCoversWithWeather || d.forecastCovers), 0);
      const totalStaffHours = operatingDays.reduce((sum, d) => sum + d.staffHours, 0);
      const totalRevenue = operatingDays.reduce((sum, d) => sum + (d.revenueWithWeather || d.revenue), 0);
      const totalLaborCost = operatingDays.reduce((sum, d) => sum + (d.laborCostWithWeather || d.laborCost), 0);
      const weekLaborCost = operatingDays.length > 0 ? totalLaborCost + MANAGER_WEEKLY_COST : totalLaborCost;
      const weekLaborPct = totalRevenue > 0 ? (weekLaborCost / totalRevenue * 100) : 0;

      return {
        ...week,
        totalCovers,
        totalStaffHours,
        totalRevenue,
        totalLaborCost: weekLaborCost,
        laborPct: weekLaborPct,
        operatingDays: operatingDays.length
      };
    });
  }, [forecasts]);

  // ========================================================================
  // LOGIN SCREEN
  // ========================================================================

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Calendar size={48} className="mx-auto mb-4 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Fayre Play Forecast</h1>
            <p className="text-gray-600 mt-2">14-Day Staffing & Revenue</p>
            <p className="text-gray-500 text-xs mt-1">(API-Powered)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="craig.neilson@thefayreplay.co.uk"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Your Booked.it password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : null}
              {loading ? 'Logging in...' : 'Login with Booked.it'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <p className="font-semibold mb-2">Demo Credentials:</p>
            <p>Email: craig.neilson@thefayreplay.co.uk</p>
            <p className="text-xs mt-2 text-gray-600">Use your actual Booked.it password</p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // MAIN DASHBOARD
  // ========================================================================

  return (
    <div className="max-w-7xl mx-auto p-4 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Calendar size={32} />
          <div>
            <h1 className="text-3xl font-bold">
              {VENUES[venue].name} 14-Day Forecast
            </h1>
            <p className="text-indigo-100">Live Booked.it Data • Weather Adjusted</p>
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
          <div className="text-sm">
            <div className="font-semibold">{user.email}</div>
            <button
              onClick={handleLogout}
              className="text-xs text-red-200 hover:text-red-100 mt-1"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Fetch Data Section */}
      <div className="bg-white rounded-lg border-2 border-dashed border-indigo-300 p-8 mb-6 text-center">
        <Calendar size={48} className="mx-auto mb-4 text-indigo-600" />
        <h3 className="text-lg font-semibold mb-2">Fetch Live Booking Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          Pull your latest bookings from Booked.it and auto-generate forecasts
        </p>

        <button
          onClick={handleFetchForecasts}
          disabled={loading}
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-indigo-700 transition disabled:opacity-50 font-semibold flex items-center gap-2 mx-auto"
        >
          {loading ? <Loader size={20} className="animate-spin" /> : <Calendar size={20} />}
          {loading ? 'Fetching...' : 'Fetch Forecasts Now'}
        </button>

        {forecasts.length > 0 && (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            ✓ Loaded {forecasts.length} days of forecast data
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Weather Status */}
        {forecasts.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Cloud size={20} className="text-blue-600" />
              <span className="font-semibold text-gray-900">Weather Integration</span>
            </div>

            {loadingWeather ? (
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3 flex items-center justify-center gap-2">
                <Loader size={16} className="animate-spin" />
                Loading weather data...
              </div>
            ) : weatherData && Object.keys(weatherData).length > 0 ? (
              <div className="text-sm bg-green-50 border-2 border-green-300 rounded p-3">
                <div className="text-green-800 font-semibold">[OK] Weather Data Active</div>
                <div className="text-green-700 text-xs mt-1">
                  {Object.keys(weatherData).length} days • {weatherLastUpdated?.toLocaleTimeString()}
                </div>
              </div>
            ) : null}

            {weatherData && (
              <button
                onClick={() => handleAutoFetchWeather()}
                disabled={loadingWeather}
                className="mt-3 text-xs bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1 mx-auto"
              >
                <RefreshCw size={14} />
                Refresh Weather
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {forecasts.length > 0 && (
        <>
          {/* Daily Tables */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const firstMonday = getMondayOfWeek(today);

            const forecastMap = {};
            forecasts.forEach(day => {
              const dateStr = getDateString(day.date);
              forecastMap[dateStr] = day;
            });

            let currentMonday = new Date(firstMonday);
            const weeks = [];

            for (let weekNum = 0; weekNum < 3; weekNum++) {
              const weekDays = [];
              for (let i = 0; i < 7; i++) {
                const date = new Date(currentMonday);
                date.setDate(date.getDate() + i);
                const dateStr = getDateString(date);
                weekDays.push(
                  forecastMap[dateStr] || {
                    date: new Date(date),
                    dateStr: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                    dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
                    isClosed: true,
                    isMissing: true
                  }
                );
              }
              weeks.push(weekDays);
              currentMonday.setDate(currentMonday.getDate() + 7);
            }

            return (
              <>
                {weeks.slice(0, 2).map((weekDays, weekIdx) => (
                  <div key={weekIdx} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">
                      {weekIdx === 0 ? 'This Week' : 'Next Week'} ({weekDays[0].dateStr})
                    </h2>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs md:text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 md:px-3 py-2 text-left">Date</th>
                            <th className="px-2 md:px-3 py-2 text-center">Day</th>
                            <th className="px-2 md:px-3 py-2 text-center">Current</th>
                            <th className="px-2 md:px-3 py-2 text-center">Mult</th>
                            <th className="px-2 md:px-3 py-2 text-center">Forecast</th>
                            {showWeatherInfo && (
                              <>
                                <th className="px-2 md:px-3 py-2 text-center">Rain</th>
                                <th className="px-2 md:px-3 py-2 text-center">Temp</th>
                                <th className="px-2 md:px-3 py-2 text-center">W.Mult</th>
                              </>
                            )}
                            <th className="px-2 md:px-3 py-2 text-center">Hrs</th>
                            <th className="px-2 md:px-3 py-2 text-right">Budget</th>
                            <th className="px-2 md:px-3 py-2 text-right">Revenue</th>
                            <th className="px-2 md:px-3 py-2 text-right">Lab%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weekDays.map((day, dayIdx) => (
                            <tr
                              key={dayIdx}
                              className={`border-t border-gray-200 ${
                                day.isPast ? 'bg-green-50' :
                                day.wasCapped ? 'bg-red-50' :
                                day.isClosed ? 'bg-gray-50' : ''
                              }`}
                            >
                              <td className="px-2 md:px-3 py-2 font-medium text-xs md:text-sm">{day.dateStr}</td>
                              <td className="px-2 md:px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                  day.dayOfWeek === 6 ? 'bg-purple-100 text-purple-800' :
                                  day.dayOfWeek === 0 ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {day.dayName}
                                </span>
                              </td>
                              <td className="px-2 md:px-3 py-2 text-center font-medium">{day.currentCovers || '-'}</td>
                              <td className="px-2 md:px-3 py-2 text-center text-xs">{day.multiplier ? `x${day.multiplier.toFixed(2)}` : '-'}</td>
                              <td className="px-2 md:px-3 py-2 text-center font-bold text-indigo-700">
                                {day.forecastCovers || '-'}{day.wasCapped && <span className="ml-1 text-red-600">[CAP]</span>}
                              </td>
                              {showWeatherInfo && (
                                <>
                                  <td className="px-2 md:px-3 py-2 text-center">
                                    {day.weatherInfo ? (
                                      <span className={day.weatherInfo.precipitation_mm > 5 ? 'text-blue-700 font-bold' : ''}>
                                        {day.weatherInfo.precipitation_mm.toFixed(1)}mm
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center">
                                    {day.weatherInfo ? (
                                      <span className={day.weatherInfo.temp_max > 20 ? 'text-red-700 font-bold' : ''}>
                                        {day.weatherInfo.temp_max.toFixed(0)}°C
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center">
                                    {day.weatherMultiplier ? (
                                      <span className={day.weatherMultiplier > 1 ? 'text-green-700 font-bold' : day.weatherMultiplier < 1 ? 'text-red-700 font-bold' : ''}>
                                        x{day.weatherMultiplier.toFixed(2)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </>
                              )}
                              <td className="px-2 md:px-3 py-2 text-center text-sm">{day.staffHours || '-'}</td>
                              <td className="px-2 md:px-3 py-2 text-right text-sm font-semibold text-blue-700">
                                {day.budgetRequired ? `£${day.budgetRequired.toFixed(0)}` : '-'}
                              </td>
                              <td className="px-2 md:px-3 py-2 text-right text-sm">
                                {day.revenue ? `£${(day.revenueWithWeather || day.revenue).toFixed(0)}` : '-'}
                              </td>
                              <td className="px-2 md:px-3 py-2 text-right">
                                {day.laborPct ? (
                                  <span className={`px-1 py-0.5 rounded text-xs font-bold ${getStatusColor(day.laborPct)}`}>
                                    {day.laborPct.toFixed(0)}%
                                  </span>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}

          {/* Weekly Summaries */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Weekly Summaries</h2>
            {weeklySummaries.map((week, idx) => (
              <div key={idx} className="bg-white rounded-lg border-2 border-indigo-200 p-6">
                <h3 className="text-lg font-bold mb-4">Week of {week.weekOf}</h3>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Operating Days</div>
                    <div className="text-xl font-bold">{week.operatingDays}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Total Covers</div>
                    <div className="text-xl font-bold text-indigo-700">{week.totalCovers}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Staff Hours</div>
                    <div className="text-xl font-bold text-green-700">{week.totalStaffHours + 75}</div>
                    <div className="text-xs text-gray-500">{week.totalStaffHours} + 75 mgr</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Staff Cost</div>
                    <div className="text-xl font-bold text-blue-700">£{week.totalLaborCost.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Revenue</div>
                    <div className="text-xl font-bold">£{week.totalRevenue.toFixed(0)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Labor %</div>
                    <div className={`text-2xl font-bold px-3 py-1 rounded inline-block ${getStatusColor(week.laborPct)}`}>
                      {week.laborPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Target: </span>
                    £{(week.totalRevenue * 0.25).toFixed(0)} for 25%
                    {week.laborPct <= 25 && (
                      <span className="text-green-700 ml-2">[✓ On Target]</span>
                    )}
                    {week.laborPct > 25 && (
                      <span className="text-red-700 ml-2">[⚠ Over Budget]</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GlasgowForecastAppAPI;
