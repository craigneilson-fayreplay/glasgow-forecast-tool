import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Calendar, TrendingUp, Users, DollarSign, AlertCircle, LogOut, Cloud, RefreshCw } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

// Replace this with your actual Google OAuth Client ID
const GOOGLE_CLIENT_ID = '774728510184-cbmd5chb33iq3r89r51pnmkmpsont4u4.apps.googleusercontent.com';
const ALLOWED_DOMAIN = '@thefayreplay.co.uk';

// Venue coordinates for weather API
const VENUE_COORDINATES = {
  glasgow: { lat: 55.8642, lon: -4.2518, name: 'Glasgow' },
  edinburgh: { lat: 55.9533, lon: -3.1883, name: 'Edinburgh' },
  newcastle: { lat: 54.9783, lon: -1.6178, name: 'Newcastle' }
};

// ============================================================================
// VENUE CAPACITY LIMITS
// ============================================================================

const VENUE_CAPACITIES = {
  glasgow: 475,
  edinburgh: 450,
  newcastle: 450
};

// ============================================================================
// WEATHER MULTIPLIERS - Based on Glasgow Analysis
// ============================================================================

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

// ============================================================================
// VENUE-SPECIFIC MULTIPLIERS
// ============================================================================

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

// Helper function to classify rainfall
const classifyRainfall = (precipitationMM) => {
  if (precipitationMM === 0) return 'noRain';
  if (precipitationMM <= 2) return 'lightRain';
  if (precipitationMM <= 5) return 'moderateRain';
  if (precipitationMM <= 10) return 'heavyRain';
  return 'veryHeavyRain';
};

// Helper function to get weather multiplier
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

// ============================================================================
// WEATHER API FUNCTION - Fetch from Open-Meteo
// ============================================================================

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

// ============================================================================
// HELPER: Get Monday of current week
// ============================================================================

const getMondayOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  
  // Sunday is 0, Monday is 1, Tuesday is 2, etc.
  // We want to find Monday of this week
  let daysToSubtract;
  if (day === 0) {
    // Today is Sunday - Monday was 6 days ago
    daysToSubtract = 6;
  } else if (day === 1) {
    // Today is Monday - we're already on Monday
    daysToSubtract = 0;
  } else {
    // Today is Tue-Sat - Monday was (day-1) days ago
    daysToSubtract = day - 1;
  }
  
  d.setDate(d.getDate() - daysToSubtract);
  return d;
};

// ============================================================================
// HELPER: Get consistent date string (YYYY-MM-DD) in local time
// ============================================================================

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
  const REVENUE_PER_COVER = 20.47;
  const TARGET_LABOR_PCT = 25;
  const HOURLY_RATE = 12.60;
  const MANAGER_WEEKLY_COST = 596.15;

  const getRevenuePerCover = (dayOfWeek) => {
    const revenueByVenue = {
      glasgow: {
        0: 26.74,
        1: 25.70,
        2: 25.70,
        3: 25.70,
        4: 25.70,
        5: 27.72,
        6: 27.59
      },
      edinburgh: {
        0: 24.90,
        1: 22.50,
        2: 22.50,
        3: 23.50,
        4: 24.50,
        5: 27.80,
        6: 28.20
      },
      newcastle: {
        0: 26.74,
        1: 25.70,
        2: 25.70,
        3: 25.70,
        4: 25.70,
        5: 27.72,
        6: 27.59
      }
    };
    
    return revenueByVenue[venue]?.[dayOfWeek] || 25.00;
  };

  const revenuePerCoverByDay = {
    0: 26.74,
    1: 25.70,
    2: 25.70,
    3: 25.70,
    4: 25.70,
    5: 27.72,
    6: 27.59
  };

  const [user, setUser] = useState(null);
  const [venue, setVenue] = useState('glasgow');
  const [uploadedData, setUploadedData] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [error, setError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [showWeatherInfo, setShowWeatherInfo] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherLastUpdated, setWeatherLastUpdated] = useState(null);

  let minimumDailyBudgets;
  if (venue === 'edinburgh') {
    minimumDailyBudgets = {
      0: 700,
      1: 131,
      2: 131,
      3: 600,
      4: 500,
      5: 800,
      6: 1000
    };
  } else if (venue === 'newcastle') {
    minimumDailyBudgets = {
      0: 1000,
      1: 750,
      2: 750,
      3: 750,
      4: 750,
      5: 1000,
      6: 1600
    };
  } else {
    minimumDailyBudgets = {
      0: 700,
      1: 131,
      2: 131,
      3: 200,
      4: 500,
      5: 800,
      6: 1000
    };
  }

  // Target labor % by venue - Newcastle has higher target due to being new
  const getTargetLaborPct = () => {
    return venue === 'newcastle' ? 30 : 25;
  };

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

  const calculateSmartForecast = (bookingsData, multiplier) => {
    // Separate bookings into large groups (>10) and regular bookings (<=10)
    const largeGroups = bookingsData.filter(booking => booking.people > 10);
    const regularBookings = bookingsData.filter(booking => booking.people <= 10);
    
    // Calculate covers from each category
    const largeGroupCovers = largeGroups.reduce((sum, b) => sum + b.people, 0);
    const regularCovers = regularBookings.reduce((sum, b) => sum + b.people, 0);
    
    // Only apply multiplier to regular bookings (walk-ins + small bookings)
    // Large groups are assumed to be locked in and won't multiply
    const multipliedRegular = Math.round(regularCovers * multiplier);
    
    // Total forecast = multiplied regular covers + all large group covers
    const totalForecast = multipliedRegular + largeGroupCovers;
    
    return {
      totalForecast,
      largeGroupCovers,
      regularCovers,
      multipliedRegular
    };
  };

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
    setUploadedData(null);
    setWeatherData(null);
  };

  React.useEffect(() => {
    const storedUser = sessionStorage.getItem('glasgowForecastUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (forecasts.length > 0 && !weatherData && !loadingWeather) {
      handleAutoFetchWeather();
    }
  }, [forecasts.length]);

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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError(null);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const dateCol = headers.findIndex(h => h === 'Event date');
      const peopleCol = headers.findIndex(h => h === 'people');
      const statusCol = headers.findIndex(h => h === 'status');
      const userIdCol = headers.findIndex(h => h === 'user_id');
      const amountCol = headers.findIndex(h => h === 'amount');
      const emailCol = headers.findIndex(h => h === 'email');
      const usernameCol = headers.findIndex(h => h === 'username');
      const venueCol = headers.findIndex(h => h.toLowerCase() === 'venue' || h.toLowerCase() === 'location' || h.toLowerCase() === 'site');
      
      if (dateCol === -1 || peopleCol === -1) {
        setError(`CSV columns not found. Found: ${headers.join(', ')}`);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ========================================================================
      // CRITICAL FIX: Get Monday of current week
      // This ensures we only show current week + next week, never prior weeks
      // ========================================================================
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
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const row = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        row.push(current);

        if (row.length < headers.length - 5) continue;

        const dateStr = row[dateCol];
        const people = parseInt(row[peopleCol]) || 0;
        const status = statusCol !== -1 ? row[statusCol].toLowerCase() : 'active';
        const email = emailCol !== -1 ? row[emailCol].toLowerCase() : '';
        const username = usernameCol !== -1 ? row[usernameCol].toLowerCase() : '';

        // FILTER: Skip test data
        if (email.includes('test') || username.includes('test')) {
          continue;
        }

        // FILTER: Only include bookings for selected venue
        if (venueCol !== -1) {
          const bookingVenue = row[venueCol].toLowerCase().trim();
          // Check if the booking venue matches the selected venue
          if (!bookingVenue.includes(venue.toLowerCase())) {
            continue;
          }
        }

        if (status !== 'active') continue;
        if (people === 0) continue;

        try {
          const dateParts = dateStr.split(' ')[0].split('-');
          const timeParts = dateStr.split(' ')[1]?.split(':') || [0, 0, 0];
          const eventDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            parseInt(timeParts[0]),
            parseInt(timeParts[1]),
            parseInt(timeParts[2])
          );
          
          if (isNaN(eventDate.getTime())) continue;
          
          // ========================================================================
          // NEW FILTER: Only include bookings from this week or next week
          // Skip any prior week bookings (which can happen due to export glitches)
          // ========================================================================
          if (eventDate < mondayThisWeek || eventDate > sundayNextWeek) {
            continue;
          }
          
          const bookingHour = eventDate.getHours();
          const groupDate = new Date(eventDate);
          groupDate.setHours(0, 0, 0, 0);
          
          const dateKey = getDateString(groupDate);
          
          if (!bookingsByDate[dateKey]) {
            bookingsByDate[dateKey] = {
              date: new Date(groupDate),
              bookingCount: 0,
              covers: 0,
              bookingHours: [],
              bookings: [] // Track individual bookings for smart forecast
            };
          }
          
          bookingsByDate[dateKey].bookingCount++;
          bookingsByDate[dateKey].covers += people;
          bookingsByDate[dateKey].bookingHours.push(bookingHour);
          bookingsByDate[dateKey].bookings.push({ people }); // Store individual booking
          
        } catch (e) {
          continue;
        }
      }

      const parsedData = [];
      
      for (const dateKey in bookingsByDate) {
        const data = bookingsByDate[dateKey];
        const eventDate = data.date;
        
        const daysUntil = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));
        
        // Only include within this week + next week
        if (daysUntil >= -6 && daysUntil <= 13) {
          const dayOfWeek = eventDate.getDay();
          
          const isPastDate = eventDate < today;
          let multiplier = 1.0;
          let forecastCovers = data.covers;
          
          if (!isPastDate) {
            multiplier = calculateMultiplier(dayOfWeek, daysUntil);
            
            // Use smart forecast to separate large groups from multiplier
            const smartForecast = calculateSmartForecast(data.bookings, multiplier);
            forecastCovers = smartForecast.totalForecast;
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
        setError('No valid active bookings found for the next 14 days');
        return;
      }

      parsedData.sort((a, b) => a.date - b.date);

      const result = [];
      const allDates = new Set();
      
      parsedData.forEach(day => {
        const dateStr = getDateString(day.date);
        allDates.add(dateStr);
      });

      // Fill in missing dates for this week + next week only
      for (let i = -6; i <= 13; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + i);
        checkDate.setHours(0, 0, 0, 0);
        
        const dayOfWeek = checkDate.getDay();
        const dateStr = getDateString(checkDate);
        
        if (!allDates.has(dateStr)) {
          let normallyClosedDays = [1, 2, 3];
          if (venue === 'edinburgh') {
            normallyClosedDays = [1, 2];
          } else if (venue === 'newcastle') {
            normallyClosedDays = [];
          }
          
          if (normallyClosedDays.includes(dayOfWeek)) {
            const minimumBudget = minimumDailyBudgets[dayOfWeek];
            
            result.push({
              date: checkDate,
              dateStr: checkDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
              dayOfWeek,
              dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
              daysUntil: i,
              currentBookings: 0,
              currentCovers: 0,
              multiplier: 1.0,
              forecastCovers: 0,
              staffHours: 0,
              revenue: 0,
              laborCost: 0,
              laborPct: 0,
              budgetRequired: minimumBudget,
              minimumBudget: minimumBudget,
              isClosed: true,
              isPotentialPrivateFunction: false,
              isPast: false,
              weatherMultiplier: 1.0,
              weatherInfo: null,
              wasCapped: false,
              venueCapacity: VENUE_CAPACITIES[venue]
            });
          }
        }
      }

      const finalForecasts = [...parsedData, ...result].sort((a, b) => a.date - b.date);
      setForecasts(finalForecasts);
      setUploadedData(file.name);
      setWeatherData(null);

    } catch (err) {
      setError(`Error reading file: ${err.message}`);
    }
  };

  const weeklySummaries = useMemo(() => {
    if (forecasts.length === 0) return [];

    const weeks = [];
    let currentWeek = [];
    let weekStartDate = null;

    forecasts.forEach((day, idx) => {
      const dayOfWeek = day.date.getDay();
      
      if (dayOfWeek === 1 || idx === 0) {
        if (currentWeek.length > 0) {
          weeks.push({
            weekOf: weekStartDate,
            days: currentWeek
          });
        }
        currentWeek = [];
        weekStartDate = day.dateStr;
      }
      
      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      weeks.push({
        weekOf: weekStartDate,
        days: currentWeek
      });
    }

    return weeks.map(week => {
      const operatingDays = week.days.filter(d => !d.isClosed);
      const totalCovers = operatingDays.reduce((sum, d) => sum + (d.forecastCoversWithWeather || d.forecastCovers), 0);
      const totalStaffHours = operatingDays.reduce((sum, d) => sum + d.staffHours, 0);
      const totalRevenue = operatingDays.reduce((sum, d) => sum + (d.revenueWithWeather || d.revenue), 0);
      const totalLaborCost = operatingDays.reduce((sum, d) => sum + (d.laborCostWithWeather || d.laborCost), 0);
      const totalBudgetRequired = operatingDays.reduce((sum, d) => sum + (d.budgetRequired || 0), 0);
      
      const weekLaborCost = operatingDays.length > 0 ? totalLaborCost + MANAGER_WEEKLY_COST : totalLaborCost;
      const weekLaborPct = totalRevenue > 0 ? (weekLaborCost / totalRevenue * 100) : 0;

      return {
        ...week,
        totalCovers,
        totalStaffHours,
        totalRevenue,
        totalLaborCost: weekLaborCost,
        totalBudgetRequired,
        laborPct: weekLaborPct,
        operatingDays: operatingDays.length
      };
    });
  }, [forecasts]);

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
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          <Calendar size={32} />
          <div>
            <h1 className="text-3xl font-bold">{VENUE_COORDINATES[venue].name} 14-Day Staffing Forecast</h1>
            <p className="text-indigo-100">With Automatic Weather Integration</p>
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
                setUploadedData(null);
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

      <div className="bg-white rounded-lg border-2 border-dashed border-indigo-300 p-8 text-center mb-6">
        <Upload size={48} className="mx-auto mb-4 text-indigo-600" />
        <h3 className="text-lg font-semibold mb-2">Upload Booking Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          CSV from Booked.it (next 14 days)
        </p>
        
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-indigo-700 transition"
        >
          Choose CSV File
        </label>

        {uploadedData && (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            [OK] Loaded: {uploadedData}
          </div>
        )}

        {forecasts.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2">
              <Cloud size={20} className="text-blue-600" />
              <span className="font-semibold text-gray-900">Weather Data Status</span>
            </div>
            
            {loadingWeather ? (
              <div className="mt-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                Loading weather from Open-Meteo API...
              </div>
            ) : weatherData && Object.keys(weatherData).length > 0 ? (
              <div className="mt-3 text-sm bg-green-50 border-2 border-green-300 rounded p-3">
                <div className="text-green-800 font-semibold">[OK] Weather Data Loaded Successfully</div>
                <div className="text-green-700 text-xs mt-1">
                  {Object.keys(weatherData).length} days of data ready
                  {weatherLastUpdated && (
                    <div>
                      Updated: {weatherLastUpdated.toLocaleTimeString()} ({weatherLastUpdated.toLocaleDateString()})
                    </div>
                  )}
                </div>
                <div className="text-green-700 text-xs mt-2 font-semibold">
                  Weather columns are now visible in the tables above
                </div>
              </div>
            ) : !loadingWeather ? (
              <div className="mt-3 text-sm bg-red-50 border-2 border-red-300 rounded p-3">
                <div className="text-red-800 font-semibold">[WARNING] Weather Data Not Yet Loaded</div>
                <div className="text-red-700 text-xs mt-1">
                  Still waiting for weather API response...
                </div>
                <button
                  onClick={handleRefreshWeather}
                  className="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Try Again
                </button>
              </div>
            ) : null}
            
            {weatherData && Object.keys(weatherData).length > 0 && (
              <button
                onClick={handleRefreshWeather}
                disabled={loadingWeather}
                className="mt-3 text-xs bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1 mx-auto"
              >
                <RefreshCw size={14} />
                Refresh Weather Data
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-4 flex items-start gap-2">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {forecasts.length > 0 && (
        <>
          {(() => {
            if (forecasts.length === 0) return null;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const getWeekDays = (monday) => {
              const days = [];
              for (let i = 0; i < 7; i++) {
                const date = new Date(monday);
                date.setDate(date.getDate() + i);
                days.push(date);
              }
              return days;
            };
            
            // CRITICAL: Use TODAY's date to calculate Monday, not the first booking date
            // This ensures we always show "This Week" starting from Monday of the current week
            const firstMonday = getMondayOfWeek(today);
            
            const forecastMap = {};
            forecasts.forEach(day => {
              const dateStr = getDateString(day.date);
              forecastMap[dateStr] = day;
            });
            
            const isPastDate = (date) => {
              const d = new Date(date);
              d.setHours(0, 0, 0, 0);
              return d < today;
            };
            
            let currentMonday = new Date(firstMonday);
            const allWeeks = [];
            
            for (let weekNum = 0; weekNum < 3; weekNum++) {
              const weekDays = getWeekDays(currentMonday);
              const weekData = weekDays.map(date => {
                const dateStr = getDateString(date);
                return forecastMap[dateStr] || {
                  date: new Date(date),
                  dateStr: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                  dayOfWeek: date.getDay(),
                  dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
                  daysUntil: Math.round((date - today) / (1000 * 60 * 60 * 24)),
                  currentBookings: 0,
                  currentCovers: 0,
                  multiplier: 1.0,
                  forecastCovers: 0,
                  staffHours: 0,
                  revenue: 0,
                  laborCost: 0,
                  laborPct: 0,
                  budgetRequired: 0,
                  minimumBudget: 0,
                  isClosed: false,
                  isPotentialPrivateFunction: false,
                  weatherInfo: null,
                  weatherMultiplier: 1.0,
                  forecastCoversWithWeather: 0,
                  revenueWithWeather: 0,
                  isMissing: true,
                  isPast: isPastDate(date)
                };
              });
              
              allWeeks.push({
                monday: new Date(currentMonday),
                days: weekData
              });
              
              currentMonday.setDate(currentMonday.getDate() + 7);
            }
            
            const thisWeek = allWeeks[0]?.days || [];
            const nextWeek = allWeeks[1]?.days || [];
            
            const formatWeekLabel = (mondayDate) => {
              const sunday = new Date(mondayDate);
              sunday.setDate(sunday.getDate() + 6);
              const monStr = mondayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              const sunStr = sunday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              return `${monStr} - ${sunStr}`;
            };
            
            return (
              <>
                {thisWeek.length > 0 && allWeeks.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold">This Week ({formatWeekLabel(allWeeks[0].monday)})</h2>
                      <button
                        onClick={() => setShowWeatherInfo(!showWeatherInfo)}
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition flex items-center gap-1"
                      >
                        <Cloud size={14} />
                        {showWeatherInfo ? 'Hide' : 'Show'} Weather
                      </button>
                    </div>
                    
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
                                <th className="px-2 md:px-3 py-2 text-center">Rain (mm)</th>
                                <th className="px-2 md:px-3 py-2 text-center">Temp (C)</th>
                                <th className="px-2 md:px-3 py-2 text-center">W.Mult</th>
                                <th className="px-2 md:px-3 py-2 text-center">Adj.</th>
                              </>
                            )}
                            <th className="px-2 md:px-3 py-2 text-center">Hrs</th>
                            <th className="px-2 md:px-3 py-2 text-right">Budget</th>
                            <th className="px-2 md:px-3 py-2 text-right">Revenue</th>
                            <th className="px-2 md:px-3 py-2 text-right">Lab%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {thisWeek.map((day, idx) => (
                            <tr key={idx} className={`border-t border-gray-200 ${
                              day.isPast ? 'bg-green-50' :
                              day.wasCapped ? 'bg-red-50 border-red-300' :
                              day.isPotentialPrivateFunction ? 'bg-yellow-50' : 
                              day.isClosed ? 'bg-gray-50' : ''
                            }`}>
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
                              <td className="px-2 md:px-3 py-2 text-center font-medium">{day.currentCovers}</td>
                              <td className="px-2 md:px-3 py-2 text-center text-xs">x{day.multiplier.toFixed(2)}</td>
                              <td className="px-2 md:px-3 py-2 text-center font-bold"><span className={day.wasCapped ? 'text-red-700' : 'text-indigo-700'}>{day.forecastCovers}{day.wasCapped && <span className="ml-1 font-bold" title={`Exceeds capacity of ${day.venueCapacity}`}>[CAP]</span>}</span></td>
                              {showWeatherInfo && (
                                <>
                                  <td className="px-2 md:px-3 py-2 text-center font-bold">
                                    {day.weatherInfo ? (
                                      <span className={day.weatherInfo.precipitation_mm > 5 ? 'text-blue-700' : 'text-gray-700'}>
                                        {day.weatherInfo.precipitation_mm.toFixed(1)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center font-bold">
                                    {day.weatherInfo ? (
                                      <span className={day.weatherInfo.temp_max > 20 ? 'text-red-700' : 'text-gray-700'}>
                                        {day.weatherInfo.temp_max.toFixed(0)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center">
                                    {day.weatherMultiplier ? (
                                      <span className={day.weatherMultiplier > 1 ? 'text-green-700 font-bold' : day.weatherMultiplier < 1 ? 'text-red-700 font-bold' : 'text-gray-600'}>
                                        x{day.weatherMultiplier.toFixed(2)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center font-bold text-blue-700">
                                    {day.forecastCoversWithWeather !== undefined ? day.forecastCoversWithWeather : day.forecastCovers}
                                  </td>
                                </>
                              )}
                              <td className="px-2 md:px-3 py-2 text-center text-sm">{day.staffHours}</td>
                              <td className="px-2 md:px-3 py-2 text-right text-sm font-semibold text-blue-700">Â£{day.budgetRequired.toFixed(0)}</td>
                              <td className="px-2 md:px-3 py-2 text-right text-sm">Â£{(day.revenueWithWeather || day.revenue).toFixed(0)}</td>
                              <td className="px-2 md:px-3 py-2 text-right">
                                <span className={`px-1 py-0.5 rounded text-xs font-bold ${getStatusColor(day.laborPct)}`}>
                                  {day.laborPct.toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {nextWeek.length > 0 && allWeeks.length > 1 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold">Next Week ({formatWeekLabel(allWeeks[1].monday)})</h2>
                      <button
                        onClick={() => setShowWeatherInfo(!showWeatherInfo)}
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition flex items-center gap-1"
                      >
                        <Cloud size={14} />
                        {showWeatherInfo ? 'Hide' : 'Show'} Weather
                      </button>
                    </div>
                    
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
                                <th className="px-2 md:px-3 py-2 text-center">Rain (mm)</th>
                                <th className="px-2 md:px-3 py-2 text-center">Temp (C)</th>
                                <th className="px-2 md:px-3 py-2 text-center">W.Mult</th>
                                <th className="px-2 md:px-3 py-2 text-center">Adj.</th>
                              </>
                            )}
                            <th className="px-2 md:px-3 py-2 text-center">Hrs</th>
                            <th className="px-2 md:px-3 py-2 text-right">Budget</th>
                            <th className="px-2 md:px-3 py-2 text-right">Revenue</th>
                            <th className="px-2 md:px-3 py-2 text-right">Lab%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nextWeek.map((day, idx) => (
                            <tr key={idx} className={`border-t border-gray-200 ${
                              day.isPast ? 'bg-green-50' :
                              day.wasCapped ? 'bg-red-50 border-red-300' :
                              day.isPotentialPrivateFunction ? 'bg-yellow-50' : 
                              day.isClosed ? 'bg-gray-50' : ''
                            }`}>
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
                              <td className="px-2 md:px-3 py-2 text-center font-medium">{day.currentCovers}</td>
                              <td className="px-2 md:px-3 py-2 text-center text-xs">x{day.multiplier.toFixed(2)}</td>
                              <td className="px-2 md:px-3 py-2 text-center font-bold"><span className={day.wasCapped ? 'text-red-700' : 'text-indigo-700'}>{day.forecastCovers}{day.wasCapped && <span className="ml-1 font-bold" title={`Exceeds capacity of ${day.venueCapacity}`}>[CAP]</span>}</span></td>
                              {showWeatherInfo && (
                                <>
                                  <td className="px-2 md:px-3 py-2 text-center font-bold">
                                    {day.weatherInfo ? (
                                      <span className={day.weatherInfo.precipitation_mm > 5 ? 'text-blue-700' : 'text-gray-700'}>
                                        {day.weatherInfo.precipitation_mm.toFixed(1)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center font-bold">
                                    {day.weatherInfo ? (
                                      <span className={day.weatherInfo.temp_max > 20 ? 'text-red-700' : 'text-gray-700'}>
                                        {day.weatherInfo.temp_max.toFixed(0)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center">
                                    {day.weatherMultiplier ? (
                                      <span className={day.weatherMultiplier > 1 ? 'text-green-700 font-bold' : day.weatherMultiplier < 1 ? 'text-red-700 font-bold' : 'text-gray-600'}>
                                        x{day.weatherMultiplier.toFixed(2)}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 md:px-3 py-2 text-center font-bold text-blue-700">
                                    {day.forecastCoversWithWeather !== undefined ? day.forecastCoversWithWeather : day.forecastCovers}
                                  </td>
                                </>
                              )}
                              <td className="px-2 md:px-3 py-2 text-center text-sm">{day.staffHours}</td>
                              <td className="px-2 md:px-3 py-2 text-right text-sm font-semibold text-blue-700">Â£{day.budgetRequired.toFixed(0)}</td>
                              <td className="px-2 md:px-3 py-2 text-right text-sm">Â£{(day.revenueWithWeather || day.revenue).toFixed(0)}</td>
                              <td className="px-2 md:px-3 py-2 text-right">
                                <span className={`px-1 py-0.5 rounded text-xs font-bold ${getStatusColor(day.laborPct)}`}>
                                  {day.laborPct.toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

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
                    <div className="text-xs text-gray-600 mb-1">Required Budget</div>
                    <div className="text-xl font-bold text-blue-700">Â£{(week.totalBudgetRequired || 0).toFixed(0)}</div>
                    <div className="text-xs text-gray-500">Actual: Â£{week.totalLaborCost.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Revenue</div>
                    <div className="text-xl font-bold">Â£{week.totalRevenue.toFixed(0)}</div>
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
                    Â£{(week.totalRevenue * 0.25).toFixed(0)} for 25%
                    {week.laborPct <= 25 && (
                      <span className="text-green-700 ml-2">[OK] Under budget</span>
                    )}
                    {week.laborPct > 25 && (
                      <span className="text-red-700 ml-2">[WARNING] Over budget</span>
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

const ProtectedGlasgowForecast = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Glasgow14DayForecast />
    </GoogleOAuthProvider>
  );
};

export default ProtectedGlasgowForecast;
