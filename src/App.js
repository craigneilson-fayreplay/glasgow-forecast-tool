import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Calendar, Users, DollarSign, AlertCircle, LogOut, Cloud, RefreshCw, ArrowRight, Table, Download, Info } from 'lucide-react';

// ============================================================================
// ⚠️ GITHUB INSTRUCTION: UNCOMMENT THIS LINE FOR PRODUCTION ⚠️
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_CLIENT_ID = '774728510184-cbmd5chb33iq3r89r51pnmkmpsont4u4.apps.googleusercontent.com';
const ALLOWED_DOMAIN = '@thefayreplay.co.uk';

const VENUES = {
  glasgow: { id: 'glasgow', name: 'Glasgow', lat: 55.8642, lon: -4.2518, capacity: 475 },
  edinburgh: { id: 'edinburgh', name: 'Edinburgh', lat: 55.9533, lon: -3.1883, capacity: 450 },
  newcastle: { id: 'newcastle', name: 'Newcastle', lat: 54.9783, lon: -1.6178, capacity: 450 }
};

// Standard Operating Days (0=Sun, 1=Mon, ..., 6=Sat)
// Used to highlight extra opening days in yellow
const STANDARD_OPEN_DAYS = {
  glasgow: [4, 5, 6, 0], // Thu-Sun
  edinburgh: [3, 4, 5, 6, 0], // Wed-Sun
  newcastle: [1, 2, 3, 4, 5, 6, 0] // All week
};

const FINANCIALS = {
  // FIXED AVERAGE SPEND PER CUSTOMER TYPE
  REVENUE_PER_COVER: {
    glasgow: 25.00,
    edinburgh: 24.50,
    newcastle: 26.00
  },
  HOURLY_RATE: 12.60,
  BUDGET_DIVISOR: 13.5, // Used to convert Budget £ into Staff Hours
  MANAGER_WEEKLY_COST: 596.15,
  TARGET_LABOR_PCT: 25,
  MIN_BUDGET_PCT: 0.15, // Minimum 15% of revenue allocated to budget
  LARGE_GROUP_UPSELL_PCT: 0.10 // Add 10% to large group booked value
};

// Minimum Daily Budgets (Manager costs on closed days vs Ops cost on open days)
const MINIMUM_DAILY_BUDGETS = {
  glasgow: { 0: 700, 1: 131, 2: 131, 3: 200, 4: 500, 5: 800, 6: 1000 },
  edinburgh: { 0: 700, 1: 131, 2: 131, 3: 600, 4: 1645, 5: 800, 6: 1000 },
  newcastle: { 0: 1000, 1: 750, 2: 750, 3: 750, 4: 750, 5: 1000, 6: 1600 }
};

const MULTIPLIERS = {
  glasgow: {
    0: { day14: 8.81, day7: 4.55, day3: 2.36, day1: 1.63 },
    1: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    2: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    3: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    4: { day14: 5.03, day7: 2.92, day3: 1.86, day1: 1.37 },
    5: { day14: 4.54, day7: 3.02, day3: 1.97, day1: 1.43 },
    6: { day14: 6.85, day7: 3.25, day3: 1.95, day1: 1.43 }
  },
  default: {
    0: { day14: 5.0, day7: 3.0, day3: 2.0, day1: 1.5 },
    1: { day14: 3.0, day7: 2.0, day3: 1.5, day1: 1.2 },
    2: { day14: 3.0, day7: 2.0, day3: 1.5, day1: 1.2 },
    3: { day14: 3.0, day7: 2.0, day3: 1.5, day1: 1.2 },
    4: { day14: 4.0, day7: 2.5, day3: 1.8, day1: 1.4 },
    5: { day14: 4.5, day7: 3.0, day3: 2.0, day1: 1.5 },
    6: { day14: 6.0, day7: 3.5, day3: 2.2, day1: 1.6 }
  }
};

// ============================================================================
// UTILITIES
// ============================================================================

const getMultipliers = (venue, dayOfWeek) => {
  const venueData = MULTIPLIERS[venue] || MULTIPLIERS.default;
  return venueData[dayOfWeek] || venueData[0];
};

const getMultiplierForDaysOut = (multipliers, daysOut) => {
  if (daysOut >= 14) return multipliers.day14;
  if (daysOut >= 7) return multipliers.day7;
  if (daysOut >= 3) return multipliers.day3;
  return multipliers.day1;
};

const formatDate = (date) => {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
};

const getMonday = (d) => {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

// ============================================================================
// API & DATA FETCHING
// ============================================================================

const fetchWeather = async (venue, days = 16) => {
  try {
    const coords = VENUES[venue];
    if (!coords) return null;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=precipitation_sum,temperature_2m_max&timezone=Europe%2FLondon&forecast_days=${days}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.daily) return null;
    const weatherMap = {};
    data.daily.time.forEach((time, idx) => {
      weatherMap[time] = {
        rain: data.daily.precipitation_sum[idx],
        temp: data.daily.temperature_2m_max[idx]
      };
    });
    return weatherMap;
  } catch (err) {
    console.error("Weather fetch failed", err);
    return null;
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SummaryCard = ({ title, value, subtitle, status, icon: Icon }) => (
  <div className={`p-4 rounded-xl border ${status === 'good' ? 'bg-green-50 border-green-200' : status === 'warning' ? 'bg-amber-50 border-amber-200' : status === 'bad' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 shadow-sm'}`}>
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      {Icon && <Icon size={18} className="text-gray-400" />}
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {subtitle && <div className={`text-xs mt-1 ${status === 'good' ? 'text-green-700' : status === 'bad' ? 'text-red-700' : 'text-gray-500'}`}>{subtitle}</div>}
  </div>
);

const ForecastTable = ({ data, showWeather }) => {
  if (!data || data.length === 0) return <div className="p-8 text-center text-gray-500">No data for this period</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-center">Booked</th>
            <th className="px-4 py-3 text-center">Type</th>
            <th className="px-4 py-3 text-center">Mult</th>
            {showWeather && <th className="px-4 py-3 text-center">Weather</th>}
            <th className="px-4 py-3 text-center bg-indigo-50 text-indigo-900 font-bold">Forecast</th>
            <th className="px-4 py-3 text-center">Staff Hrs</th>
            <th className="px-4 py-3 text-right">Budget £</th>
            <th className="px-4 py-3 text-right">Est. Rev</th>
            <th className="px-4 py-3 text-right">Labor %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((day, i) => {
            const isHighLabor = day.laborPct > 30;
            const isLowLabor = day.laborPct < 20;
            const laborColor = isHighLabor ? 'text-red-600 bg-red-50' : isLowLabor ? 'text-green-600 bg-green-50' : 'text-gray-700';
            
            // Yellow Highlight for Non-Standard Operating Days
            const isExtraDay = day.isExtraDay;
            const rowClass = isExtraDay ? 'bg-yellow-50 hover:bg-yellow-100' : `hover:bg-gray-50 ${day.isToday ? 'bg-blue-50/50' : ''} ${day.isPast ? 'opacity-60 bg-gray-50' : ''}`;

            return (
              <tr key={i} className={`transition-colors ${rowClass}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{day.dateStr}</div>
                  <div className="text-xs text-gray-500">
                    {day.dayName} 
                    {day.isToday && <span className="ml-1 text-blue-600 font-bold">(Today)</span>}
                    {isExtraDay && <span className="ml-1 text-amber-600 font-bold">(Extra Open)</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                   <div className="flex flex-col">
                     <span>{day.currentCovers}</span>
                     {day.largeGroupCovers > 0 && <span className="text-[10px] text-gray-400">({day.largeGroupCovers} Lrg)</span>}
                   </div>
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">
                  {day.largeGroupCovers > 0 ? 'Mixed' : 'Standard'}
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-400">
                  {day.isPast ? '-' : `x${day.multiplier.toFixed(1)}`}
                </td>
                
                {showWeather && (
                  <td className="px-4 py-3 text-center">
                    {day.weather ? (
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-bold ${day.weather.rain > 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {day.weather.rain > 0 ? `${day.weather.rain}mm` : 'Dry'}
                        </span>
                        <span className="text-[10px] text-gray-400">{day.weather.temp}°C</span>
                      </div>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                )}

                <td className="px-4 py-3 text-center bg-indigo-50/50">
                  <span className={`font-bold ${day.isPast ? 'text-gray-600' : 'text-indigo-700'}`}>
                    {day.forecastCovers}
                  </span>
                  {day.wasCapped && <span className="ml-1 text-[10px] text-red-500 font-bold">CAP</span>}
                </td>
                <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{day.staffHours}</td>
                
                {/* BUDGET COLUMN */}
                <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50/50">
                  £{day.budget.toFixed(0)}
                </td>

                <td className="px-4 py-3 text-right font-medium text-gray-800">
                    £{day.revenue.toFixed(0)}
                </td>

                <td className="px-4 py-3 text-right">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${laborColor}`}>
                    {day.laborPct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Glasgow14DayForecast = () => {
  const [user, setUser] = useState(null);
  const [venue, setVenue] = useState('glasgow');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [rawData, setRawData] = useState([]); 
  const [weatherData, setWeatherData] = useState(null);
  const [showWeather, setShowWeather] = useState(true);
  const [loginError, setLoginError] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('gf_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const handleLoginSuccess = (credentialResponse) => {
    // ⚠️ MOCK FOR PREVIEW ⚠️
    if (credentialResponse.credential === "mock_token_for_preview") {
       const userData = { email: "demo@thefayreplay.co.uk", name: "Preview User" };
       setUser(userData);
       sessionStorage.setItem('gf_user', JSON.stringify(userData));
       return;
    }

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
        sessionStorage.setItem('gf_user', JSON.stringify(userData));
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
    sessionStorage.removeItem('gf_user');
    setRawData([]);
  };

  // --------------------------------------------------------------------------
  // PROJECTION LOGIC
  // --------------------------------------------------------------------------
  
  const projection = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const startOfView = getMonday(today);
    const endOfCurrentWeek = new Date(startOfView);
    endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + 6);
    endOfCurrentWeek.setHours(23,59,59,999);
    
    const endOfView = new Date(endOfCurrentWeek);
    endOfView.setDate(endOfView.getDate() + 7);
    endOfView.setHours(23,59,59,999);

    const processedDays = [];
    let iterDate = new Date(startOfView);

    while (iterDate <= endOfView) {
      const dateKey = iterDate.toISOString().split('T')[0];
      
      // -- VENUE FILTERING HAPPENS HERE NOW --
      const dayData = rawData.find(d => d.dateKey === dateKey && d.venue.includes(venue));
      
      const regularCovers = dayData ? dayData.regularCovers : 0;
      const largeGroupCovers = dayData ? dayData.largeGroupCovers : 0;
      // Note: bookedRevenue here acts as the 'base' booked revenue from file
      const bookedRevenueLarge = dayData ? dayData.largeGroupRevenue : 0; 
      
      const currentCovers = regularCovers + largeGroupCovers;

      const daysOut = Math.floor((iterDate - today) / (1000 * 60 * 60 * 24));
      const dayOfWeek = iterDate.getDay(); 
      const isPast = daysOut < 0;

      // 2. Multiplier (Applied to Regular Covers ONLY)
      const baseMults = getMultipliers(venue, dayOfWeek);
      let multiplier = getMultiplierForDaysOut(baseMults, Math.max(0, daysOut));
      
      // Weather
      let weatherMult = 1.0;
      let dayWeather = null;
      if (weatherData && weatherData[dateKey]) {
        dayWeather = weatherData[dateKey];
        if (dayWeather.rain > 5) weatherMult = 0.85;
        if (dayWeather.rain > 10) weatherMult = 0.70;
        if (dayWeather.temp > 18) weatherMult *= 1.2;
      }
      
      const finalMult = isPast ? 1.0 : (multiplier * weatherMult);

      // 3. Forecast Logic
      let projectedRegular = Math.round(regularCovers * finalMult);
      let forecastCovers = projectedRegular + largeGroupCovers;
      
      const cap = VENUES[venue].capacity;
      const wasCapped = forecastCovers > cap;
      if (wasCapped) forecastCovers = cap;

      // 4. REVENUE CALCULATION (Split Logic)
      // A. Large Groups: Use actual booked revenue + 10% upsell
      const largeGroupRevenue = bookedRevenueLarge * (1 + FINANCIALS.LARGE_GROUP_UPSELL_PCT);
      
      // B. Regular Customers (Walk-ins/Small): Use standard average spend
      const standardAvgSpend = FINANCIALS.REVENUE_PER_COVER[venue] || 25.00;
      const regularRevenue = projectedRegular * standardAvgSpend;
      
      const revenue = largeGroupRevenue + regularRevenue;
      
      // Avg Spend for display only
      const avgSpend = forecastCovers > 0 ? (revenue / forecastCovers) : 0;

      // 5. BUDGET & HOURS CALCULATION (Updated Logic)
      // Step A: Calculate Budget (£)
      const minDailyBudget = MINIMUM_DAILY_BUDGETS[venue] ? (MINIMUM_DAILY_BUDGETS[venue][dayOfWeek] || 131) : 131;
      const incomeBasedBudget = revenue * FINANCIALS.MIN_BUDGET_PCT; // 15%
      const budget = Math.max(incomeBasedBudget, minDailyBudget);

      // Step B: Calculate Staff Hours based on Budget
      // Formula: Budget / 13.5 (approx fully loaded hourly cost)
      const staffHours = Math.round(budget / FINANCIALS.BUDGET_DIVISOR);

      // Step C: Calculate Estimated Labor Cost based on allocated hours
      // This calculates the 'real' cost of those hours using the base rate + manager allocation
      const laborCost = (staffHours * FINANCIALS.HOURLY_RATE) + (FINANCIALS.MANAGER_WEEKLY_COST / 7);

      // 7. Highlight Logic
      const standardOpenDays = STANDARD_OPEN_DAYS[venue] || [];
      const isStandardOpen = standardOpenDays.includes(dayOfWeek);
      const isExtraDay = !isStandardOpen && forecastCovers > 0;

      const laborPct = revenue > 0 ? (laborCost / revenue) * 100 : 0;

      processedDays.push({
        date: new Date(iterDate),
        dateStr: formatDate(iterDate),
        dateKey,
        dayName: iterDate.toLocaleDateString('en-GB', { weekday: 'long' }),
        isToday: daysOut === 0,
        isPast,
        isExtraDay,
        
        currentCovers,
        regularCovers,
        largeGroupCovers,
        
        avgSpend, // Display only
        multiplier: finalMult,
        forecastCovers,
        wasCapped,
        
        staffHours,
        revenue,
        budget, 
        laborCost, 
        laborPct,
        
        weather: dayWeather
      });

      iterDate.setDate(iterDate.getDate() + 1);
    }

    const thisWeek = processedDays.filter(d => d.date <= endOfCurrentWeek);
    const nextWeek = processedDays.filter(d => d.date > endOfCurrentWeek);

    const calcSummary = (days) => {
      const rev = days.reduce((s, d) => s + d.revenue, 0);
      const cost = days.reduce((s, d) => s + d.laborCost, 0);
      const bud = days.reduce((s, d) => s + d.budget, 0);
      return {
        revenue: rev,
        laborCost: cost,
        budget: bud,
        laborPct: rev > 0 ? (cost/rev)*100 : 0,
        covers: days.reduce((s, d) => s + d.forecastCovers, 0)
      };
    };

    return {
      thisWeek,
      nextWeek,
      summaries: {
        thisWeek: calcSummary(thisWeek),
        nextWeek: calcSummary(nextWeek)
      }
    };

  }, [rawData, weatherData, venue]);

  // --------------------------------------------------------------------------
  // ROBUST CSV PARSER
  // --------------------------------------------------------------------------

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setUploadStats(null);

    try {
      let text = await file.text();
      text = text.replace(/^\uFEFF/, '');

      const parseCSVLine = (line) => {
        const values = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') { inQuote = !inQuote; continue; }
          if (char === ',' && !inQuote) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      };

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error("File appears empty");

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      
      let idxDate = headers.findIndex(h => h === 'event date');
      if (idxDate === -1) idxDate = headers.findIndex(h => h.includes('date') || h.includes('time'));
      const idxPeople = headers.findIndex(h => h.includes('people') || h.includes('guests') || h.includes('covers'));
      
      let idxVenue = headers.indexOf('venue');
      if (idxVenue === -1) idxVenue = headers.indexOf('location');
      if (idxVenue === -1) idxVenue = headers.findIndex(h => h.includes('venue') && !h.includes('id'));
      
      const idxAmount = headers.findIndex(h => h === 'amount' || h === 'net_amount' || h === 'total');

      if (idxDate === -1 || idxPeople === -1) throw new Error(`Missing columns.`);

      let validRows = 0;
      const aggregation = {};

      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length <= idxDate) continue;

        let rowVenue = 'unknown';
        if (idxVenue > -1 && row[idxVenue]) {
           rowVenue = row[idxVenue].toLowerCase();
        }

        let dateStr = row[idxDate].replace(/"/g, '');
        if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
        let dateVal = new Date(dateStr);
        if (isNaN(dateVal.getTime())) {
           const parts = dateStr.match(/(\d+)[/-](\d+)[/-](\d+)/);
           if (parts) {
             const d = parseInt(parts[1]);
             const m = parseInt(parts[2]) - 1;
             const y = parseInt(parts[3].length === 2 ? '20'+parts[3] : parts[3]);
             dateVal = new Date(y, m, d);
           }
        }
        if (isNaN(dateVal.getTime())) continue;

        const dateKey = dateVal.toISOString().split('T')[0];
        const people = parseInt(row[idxPeople]) || 0;
        const amount = idxAmount > -1 ? parseFloat(row[idxAmount]) || 0 : 0;

        const aggKey = `${dateKey}|${rowVenue}`;

        if (!aggregation[aggKey]) {
          aggregation[aggKey] = { 
            dateKey, 
            venue: rowVenue,
            regular: 0, 
            large: 0, 
            amount: 0,
            largeGroupRevenue: 0 
          };
        }

        // --- SPLIT LOGIC ---
        // If > 10, count as large group and track its revenue separately
        if (people > 10) {
          aggregation[aggKey].large += people;
          aggregation[aggKey].largeGroupRevenue += amount;
        } else {
          aggregation[aggKey].regular += people;
        }
        // Total amount (just for reference)
        aggregation[aggKey].amount += amount;
        validRows++;
      }

      const parsed = Object.values(aggregation).map(v => ({
        dateKey: v.dateKey,
        venue: v.venue,
        regularCovers: v.regular,
        largeGroupCovers: v.large,
        largeGroupRevenue: v.largeGroupRevenue,
        people: v.regular + v.large,
        amount: v.amount
      }));

      setUploadStats({
        total: lines.length - 1,
        valid: parsed.length
      });

      if (parsed.length === 0) {
        throw new Error(`No valid bookings found.`);
      }

      setRawData(parsed);
      const weather = await fetchWeather(venue);
      if (weather) setWeatherData(weather);

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!projection) return;
    const allDays = [...projection.thisWeek, ...projection.nextWeek];
    
    const headers = ['Date', 'Day', 'Forecast Covers', 'Revenue', 'Budget', 'Labor Cost', 'Variance'];
    const rows = allDays.map(d => [
      d.dateKey,
      d.dayName,
      d.forecastCovers,
      d.revenue.toFixed(2),
      d.budget.toFixed(2),
      d.laborCost.toFixed(2),
      (d.budget - d.laborCost).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-${venue}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg"><Calendar size={20} /></div>
            <div>
              <h1 className="text-xl font-bold leading-none">Forecast Tool</h1>
              <p className="text-xs text-gray-500 mt-1">Projection: Current Week & Next Week</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={venue} onChange={e => setVenue(e.target.value)} className="bg-gray-100 text-sm font-semibold rounded-lg px-4 py-2 hover:bg-gray-200 cursor-pointer">
              {Object.values(VENUES).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* CONTROLS & STATUS */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <label className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 cursor-pointer text-sm">
              <Upload size={16} />
              {loading ? 'Reading File...' : 'Upload CSV'}
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={() => setShowWeather(!showWeather)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border bg-gray-50 hover:bg-gray-100">
              <Cloud size={16} /> {showWeather ? 'Hide' : 'Show'} Weather
            </button>
            {rawData.length > 0 && (
              <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
                <Download size={16} /> Export
              </button>
            )}
          </div>

          {uploadStats && (
            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg flex gap-3">
              <span className="font-medium text-gray-700">File Stats:</span>
              <span>Loaded {uploadStats.valid} daily records (across all venues)</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* SECTION 1: CURRENT WEEK */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 bg-indigo-500 rounded-full"></div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">This Week</h3>
                <p className="text-xs text-gray-500">Includes past days for data verification</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <SummaryCard title="Forecast Covers" value={projection.summaries.thisWeek.covers} icon={Users} status="neutral" />
            <SummaryCard title="Est. Revenue" value={`£${projection.summaries.thisWeek.revenue.toLocaleString()}`} icon={DollarSign} status="neutral" />
            <SummaryCard title="Total Budget" value={`£${projection.summaries.thisWeek.budget.toLocaleString()}`} subtitle="Allowed Spend" status="neutral" />
            <SummaryCard 
              title="Labor Variance" 
              value={`£${(projection.summaries.thisWeek.budget - projection.summaries.thisWeek.laborCost).toFixed(0)}`} 
              subtitle={projection.summaries.thisWeek.budget > projection.summaries.thisWeek.laborCost ? "Under Budget (Good)" : "Over Budget (Bad)"}
              status={projection.summaries.thisWeek.budget > projection.summaries.thisWeek.laborCost ? 'good' : 'bad'} 
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <ForecastTable data={projection.thisWeek} showWeather={showWeather} />
          </div>
        </section>

        {/* SECTION 2: NEXT WEEK */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 bg-purple-500 rounded-full"></div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Next Week</h3>
                <p className="text-xs text-gray-500">Projected Performance</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <SummaryCard title="Forecast Covers" value={projection.summaries.nextWeek.covers} icon={Users} status="neutral" />
            <SummaryCard title="Est. Revenue" value={`£${projection.summaries.nextWeek.revenue.toLocaleString()}`} icon={DollarSign} status="neutral" />
             <SummaryCard title="Total Budget" value={`£${projection.summaries.nextWeek.budget.toLocaleString()}`} subtitle="Allowed Spend" status="neutral" />
            <SummaryCard 
              title="Labor Variance" 
              value={`£${(projection.summaries.nextWeek.budget - projection.summaries.nextWeek.laborCost).toFixed(0)}`} 
              subtitle={projection.summaries.nextWeek.budget > projection.summaries.nextWeek.laborCost ? "Under Budget (Good)" : "Over Budget (Bad)"}
              status={projection.summaries.nextWeek.budget > projection.summaries.nextWeek.laborCost ? 'good' : 'bad'} 
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <ForecastTable data={projection.nextWeek} showWeather={showWeather} />
          </div>
        </section>
      </main>
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
