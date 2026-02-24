import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Calendar, Users, DollarSign, AlertCircle, LogOut, Cloud, RefreshCw, ArrowRight, Table, Download, Info, History, FileText } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import * as XLSX from 'xlsx';

// ============================================================================
// CONFIGURATION
// ============================================================================

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
const STANDARD_OPEN_DAYS = {
  glasgow: [4, 5, 6, 0], // Thu-Sun
  edinburgh: [3, 4, 5, 6, 0], // Wed-Sun
  newcastle: [1, 2, 3, 4, 5, 6, 0] // All week
};

const FINANCIALS = {
  // FIXED AVERAGE SPEND PER CUSTOMER TYPE (Used for Walk-ins)
  REVENUE_PER_COVER: {
    glasgow: 25.00,
    edinburgh: 24.50,
    newcastle: 26.00
  },
  // Fixed Price for "Game Ticket" bookings (Ex VAT)
  GAME_TICKET_PRICE: 25.00,
  
  HOURLY_RATE: 12.60,
  BUDGET_DIVISOR: 13.5, 
  MANAGER_WEEKLY_COST: 596.15,
  TARGET_LABOR_PCT: 22, // Target labor as % of revenue - used for budget calculation
  
  // Costs per shift
  DOOR_STAFF_COST: 90.00,
  CLEANER_COST: 40.00,  // ✅ Updated from £120 to £40
  AGENCY_HOURLY_RATE: 18.00,  // ✅ Changed from per-shift to hourly rate
  MANAGER_SHIFT_COST: 150.00
};

// Minimum Daily Budgets 
const MINIMUM_DAILY_BUDGETS = {
  glasgow: { 0: 700, 1: 131, 2: 131, 3: 200, 4: 500, 5: 650, 6: 850 },
  edinburgh: { 0: 700, 1: 131, 2: 131, 3: 600, 4: 600, 5: 650, 6: 850 },
  newcastle: { 0: 1000, 1: 750, 2: 750, 3: 750, 4: 750, 5: 1000, 6: 1600 }
};

// Default Door Staff Costs by Venue and Day (0=Sun, 1=Mon, ..., 6=Sat)
const DEFAULT_DOOR_COSTS = {
  glasgow: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 300 },
  edinburgh: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 300 },
  newcastle: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 300, 6: 300 }
};

// Default DJ Costs by Venue and Day (0=Sun, 1=Mon, ..., 6=Sat)
const DEFAULT_DJ_COSTS = {
  glasgow: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  edinburgh: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  newcastle: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 120, 6: 120 }
};

// Default Manager Counts by venue and day of week (0=Sun, 1=Mon, ..., 6=Sat)
const DEFAULT_MANAGER_COUNTS = {
  glasgow: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2 },      // Sun:1, Mon:1, Tue:1, Wed:1, Thu:2, Fri:2, Sat:2
  edinburgh: { 0: 1, 1: 2, 2: 0, 3: 1, 4: 2, 5: 2, 6: 2 },   // Sun:1, Mon:2, Tue:0, Wed:1, Thu:2, Fri:2, Sat:2
  newcastle: { 0: 2, 1: 2, 2: 2, 3: 1, 4: 2, 5: 3, 6: 3 }    // Sun:2, Mon:2, Tue:2, Wed:1, Thu:2, Fri:3, Sat:3
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
  edinburgh: {
    // Edinburgh has 51% same-day bookings vs Glasgow's advance-booking culture
    // Higher multipliers needed, especially for closer dates
    0: { day14: 9.5, day7: 5.0, day3: 2.5, day1: 1.7 },  // Sunday
    1: { day14: 6.0, day7: 3.5, day3: 2.2, day1: 1.6 },  // Monday
    2: { day14: 6.0, day7: 3.5, day3: 2.2, day1: 1.6 },  // Tuesday  
    3: { day14: 6.0, day7: 3.5, day3: 2.2, day1: 1.6 },  // Wednesday (new operating day)
    4: { day14: 6.0, day7: 3.5, day3: 2.2, day1: 1.6 },  // Thursday
    5: { day14: 5.5, day7: 3.5, day3: 2.3, day1: 1.7 },  // Friday
    6: { day14: 7.5, day7: 3.8, day3: 2.3, day1: 1.7 }   // Saturday
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

const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Handle Excel serial dates
    if (typeof dateStr === 'number') {
      const date = new Date((dateStr - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle YYYY-MM-DD
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }
    
    // Handle DD/MM/YYYY (UK Format) - Common in SumUp exports
    if (typeof dateStr === 'string') {
        const parts = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (parts) {
            const d = parseInt(parts[1]);
            const m = parseInt(parts[2]) - 1; // Month is 0-indexed in JS
            const y = parseInt(parts[3]);
            // Create UTC date to avoid timezone shifts
            const date = new Date(Date.UTC(y, m, d));
            return date.toISOString().split('T')[0];
        }
    }
    
    // Fallback
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
};

// ============================================================================
// DATA FETCHING
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
                     {day.bookedRevenue > 0 && <span className="text-[10px] text-gray-400">Act: £{day.bookedRevenue.toLocaleString()}</span>}
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

const LookbackReport = () => {
  const [bookingRows, setBookingRows] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [newcastleFoodRows, setNewcastleFoodRows] = useState({}); // actual food per date
  const [timesheetRows, setTimesheetRows] = useState({
    glasgow: [],
    edinburgh: [],
    newcastle: []
  });
  const [manualAdjustments, setManualAdjustments] = useState({});

  const handleBookingUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return;
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      // FIXED: Prioritize "date" column (has reliable datetime) over "Event date" (can be stale)
      // When bookings are modified, Booked.it updates "date" but sometimes fails to update "Event date"
      let idxDate = headers.indexOf('date');
      if (idxDate === -1) idxDate = headers.findIndex(h => h === 'event date' || h === 'event_date');
      if (idxDate === -1) idxDate = headers.findIndex(h => h.includes('event') && h.includes('date'));
      
      const idxPaidAmount = headers.findIndex(h => h === 'paid_amount');
      const idxPeople = headers.indexOf('people'); // ✅ ADDED: Track people/guests field
      const idxUserId = headers.indexOf('user_id'); // ✅ ADDED: Track user_id to exclude walk-ins
      let idxVenue = headers.indexOf('venue');
      if (idxVenue === -1) idxVenue = headers.indexOf('location');

    const parsedRows = [];

    lines.slice(1).forEach(line => {
      const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        
        // UPDATED: Parse the "date" field which may include time
        const dateStr = row[idxDate];
        const dateKey = parseDate(dateStr);
      if (!dateKey) return;
      
      const paidAmount = parseFloat(row[idxPaidAmount]) || 0;
      
      // Skip if no payment was made (covers cancelled, refunded, pending automatically)
      if (paidAmount <= 0) return;
      
      let rowVenue = (row[idxVenue] || '').toLowerCase();
      
      // Skip gift card purchases (not venue bookings)
      if (rowVenue.includes('gift')) return;
      
      // Normalize venue names - use exact matches
      let normalizedVenue = null;
      if (rowVenue.includes('kinning') || rowVenue.includes('glasgow')) {
        normalizedVenue = 'glasgow';
      } else if (rowVenue.includes('edinburgh')) {
        normalizedVenue = 'edinburgh';
      } else if (rowVenue.includes('newcastle')) {
        normalizedVenue = 'newcastle';
      }
      
      // Skip rows with unrecognized venues
      if (!normalizedVenue) return;
      
      // Walk-ins have blank user_id - set revenue to 0 to avoid double-counting with POS
      // but still count their people/guests
      const userId = idxUserId !== -1 ? (row[idxUserId] || '').trim() : '';
      let revenue = 0;
      
      if (userId && userId !== '0') {
        // Advance booking - use paid_amount divided by 1.2 to get ex-VAT
        revenue = paidAmount / 1.2;
      }
      // else: walk-in, revenue stays 0
      
        
        // ✅ ADDED: Parse people/guests count
        const people = idxPeople !== -1 ? (parseInt(row[idxPeople]) || 0) : 0;
        
        parsedRows.push({ date: dateKey, venue: normalizedVenue, income: revenue, people: people });
    });
    
    console.log('Booking Upload - Total rows:', parsedRows.length);
    console.log('Booking Upload - Venues found:', [...new Set(parsedRows.map(r => r.venue))]);
    console.log('Booking Upload - Sample rows:', parsedRows.slice(0, 3));
    
    setBookingRows(parsedRows);
  };

  const handleSalesUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    // CSV Handler
    if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        
        // Find header row: Look for line starting with "Sale ID" or containing "Sale Date"
        let startIndex = -1;
        for(let i=0; i<lines.length; i++) {
           if (lines[i].includes('Sale ID') && lines[i].includes('Total')) {
               startIndex = i;
               break;
           }
        }

        if (startIndex === -1) return; // Header not found
        
        const headerLine = lines[startIndex];
        // Split header line, trimming quotes
        const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Identify column indices by name
        const idxDate = headers.findIndex(h => h === 'Sale Date');
        const idxStatus = headers.findIndex(h => h === 'Order Status');
        const idxOutlet = headers.findIndex(h => h === 'Outlet');
        const idxTotal = headers.findIndex(h => h === 'Total');
        
        const parsedRows = [];
        
        for (let i = startIndex + 1; i < lines.length; i++) {
            // Robust CSV split regex to handle commas inside quotes
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
            
            if (row.length <= idxTotal) continue; 
            
            const dateKey = parseDate(row[idxDate]);
            if (!dateKey) continue;
            
            if (row[idxStatus] === 'VOIDED') continue;
            
            // Logic: Total / 1.2 (Ex VAT)
            let total = parseFloat(row[idxTotal]);
            if (isNaN(total)) total = 0;
            const income = total / 1.2;
            
            // Venue Mapping - exact normalization
            let rowVenue = (row[idxOutlet] || '').toLowerCase();
            let normalizedVenue = null;
            if (rowVenue.includes('kinning') || rowVenue.includes('glasgow')) {
              normalizedVenue = 'glasgow';
            } else if (rowVenue.includes('edinburgh')) {
              normalizedVenue = 'edinburgh';
            } else if (rowVenue.includes('newcastle')) {
              normalizedVenue = 'newcastle';
            }
            
            // Skip rows with unrecognized venues
            if (!normalizedVenue) continue;

            parsedRows.push({ date: dateKey, venue: normalizedVenue, income: income });
        }
        
        console.log('Sales CSV Upload - Total rows:', parsedRows.length);
        console.log('Sales CSV Upload - Venues found:', [...new Set(parsedRows.map(r => r.venue))]);
        console.log('Sales CSV Upload - Sample rows:', parsedRows.slice(0, 3));
        
        setSalesRows(parsedRows);
        return;
    }

    // Excel Handler
    if (typeof XLSX === 'undefined' || !XLSX.read) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      
      // Look for 'Sales' sheet (first sheet)
      let wsname = 'Sales'; 
      let ws = wb.Sheets[wsname];
      if (!ws) {
        wsname = wb.SheetNames[0]; // Fallback to 1st sheet
        ws = wb.Sheets[wsname];
      }
      
      // CRITICAL: Find header row dynamically - SumUp has metadata rows at top
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let headerIndex = 0;
      for(let i=0; i<rawData.length; i++) {
         const row = rawData[i];
         if (Array.isArray(row) && row.some(cell => String(cell).includes('Sale ID')) && row.some(cell => String(cell).includes('Total'))) {
             headerIndex = i;
             break;
         }
      }
      
      // Now parse properly from the correct header row
      const data = XLSX.utils.sheet_to_json(ws, { range: headerIndex, defval: '' });
      
      console.log('Excel Parse - Header Index:', headerIndex);
      console.log('Excel Parse - Total data rows:', data.length);
      if (data.length > 0) {
        console.log('Excel Parse - First row keys:', Object.keys(data[0]));
        console.log('Excel Parse - First row sample:', data[0]);
      }
      
      const parsedRows = [];
      data.forEach((row, idx) => {
        const dateRaw = row['Sale Date'] || row['Date'];
        const dateKey = parseDate(dateRaw);
        if (!dateKey) {
          if (idx < 3) console.log(`Row ${idx} - No valid date:`, dateRaw);
          return;
        }
        
        if (row['Order Status'] === 'VOIDED') return;

        // Logic: Total / 1.2
        let total = parseFloat(row['Total']);
        if (isNaN(total)) total = 0;
        
        const income = total / 1.2;

        // Venue Mapping - exact normalization
        let rowVenue = (row['Outlet'] || row['Register'] || '').toLowerCase();
        let normalizedVenue = null;
        if (rowVenue.includes('kinning') || rowVenue.includes('glasgow')) {
          normalizedVenue = 'glasgow';
        } else if (rowVenue.includes('edinburgh')) {
          normalizedVenue = 'edinburgh';
        } else if (rowVenue.includes('newcastle')) {
          normalizedVenue = 'newcastle';
        }
        
        if (idx < 3) {
          console.log(`Row ${idx} - Outlet: "${row['Outlet']}", Venue: "${rowVenue}", Normalized: "${normalizedVenue}", Total: ${total}, Income: ${income.toFixed(2)}`);
        }
        
        // Skip rows with unrecognized venues
        if (!normalizedVenue) return;

        parsedRows.push({ date: dateKey, venue: normalizedVenue, income: income });
      });

      console.log('Sales Excel Upload - Total rows:', parsedRows.length);
      console.log('Sales Excel Upload - Venues found:', [...new Set(parsedRows.map(r => r.venue))]);
      console.log('Sales Excel Upload - Sample rows:', parsedRows.slice(0, 3));

      setSalesRows(parsedRows);

      // ── PARSE SALES ITEMS TAB for actual Newcastle food totals ──────────────
      // Build Sale ID → { date, outlet } from Sales tab
      const saleIdDateMap = {};
      data.forEach(row => {
        const saleId = String(row['Sale ID'] || '').trim();
        const dateRaw = row['Sale Date'] || row['Date'];
        const dateKey = parseDate(dateRaw);
        const outlet = (row['Outlet'] || row['Register'] || '').toLowerCase();
        if (saleId && dateKey && outlet.includes('newcastle')) {
          saleIdDateMap[saleId] = dateKey;
        }
      });

      const itemsSheet = wb.Sheets['Sales Items'];
      if (itemsSheet) {
        const itemsData = XLSX.utils.sheet_to_json(itemsSheet, { header: 1, defval: '' });

        // Find header row
        let itemsHeaderIdx = 0;
        for (let i = 0; i < itemsData.length; i++) {
          if (itemsData[i].some(cell => String(cell).toLowerCase().includes('product name'))) {
            itemsHeaderIdx = i;
            break;
          }
        }

        const itemsHeaders = itemsData[itemsHeaderIdx];
        const itemsRows = itemsData.slice(itemsHeaderIdx + 1);

        const saleIdIdx   = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('sale id'));
        const categoryIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('category'));
        const unitPriceIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('unit price'));
        const quantityIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('quantity'));
        const lineDiscIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('line discount'));
        const saleDiscIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('sale discount'));
        const totalIdx    = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('total'));

        const foodByDate = {};

        itemsRows.forEach(row => {
          if (!row || row.length === 0) return;

          const saleId = String(row[saleIdIdx] || '').trim();
          const dateKey = saleIdDateMap[saleId];
          if (!dateKey) return; // not Newcastle

          const category = String(row[categoryIdx] || '');
          if (!category.substring(0, 4).toLowerCase().includes('food')) return;

          const quantity   = parseFloat(row[quantityIdx])  || 0;
          const unitPrice  = parseFloat(row[unitPriceIdx]) || 0;
          const lineDisc   = parseFloat(row[lineDiscIdx])  || 0;
          const saleDisc   = parseFloat(row[saleDiscIdx])  || 0;
          const isNonToken = category.toLowerCase().includes('non-token');
          const totalDisc  = lineDisc + saleDisc;
          const isToken    = !isNonToken && Math.abs(totalDisc - unitPrice * quantity) < 0.01;

          // Value: tokens are £10 each, otherwise use Total column (inc VAT)
          const valueIncVat = isToken
            ? 10 * quantity
            : (parseFloat(row[totalIdx]) || 0);

          if (!foodByDate[dateKey]) foodByDate[dateKey] = 0;
          foodByDate[dateKey] += valueIncVat;
        });

        console.log('Newcastle actual food by date:', foodByDate);
        setNewcastleFoodRows(foodByDate);
      }
      // ────────────────────────────────────────────────────────────────────────
    };
    reader.readAsBinaryString(file);
  };

  const handleTimesheetUpload = (targetVenue) => async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).slice(1);
    
    const parsedRows = [];
    
    lines.forEach(line => {
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
      if (cols.length < 31) return;
      
      const location = (cols[4] || '').toLowerCase(); 
      const dateKey = parseDate(cols[22]); // Column 23 (index 22) = Timesheet Start Date
      const cost = parseFloat(cols[30]) || 0; // Column 31 (index 30) = Timesheet Cost
      if (!dateKey) return;

      parsedRows.push({ date: dateKey, location: location, cost: cost });
    });

    console.log(`${targetVenue} Timesheet Upload - Total rows:`, parsedRows.length);
    console.log(`${targetVenue} Timesheet Upload - Sample rows:`, parsedRows.slice(0, 3));

    setTimesheetRows(prev => ({
      ...prev,
      [targetVenue]: parsedRows
    }));
  };

  const handleAdjustmentChange = (venue, date, field, value) => {
    // Store the raw value (including empty string and partial numbers like "1.")
    // This prevents focus loss while typing
    const numValue = value === '' ? undefined : parseFloat(value);
    
    setManualAdjustments(prev => {
      const newState = {
        ...prev,
        [`${venue}_${date}`]: {
          ...prev[`${venue}_${date}`],
          [field]: numValue !== undefined && !isNaN(numValue) ? numValue : 0
        }
      };
      return newState;
    });
  };

  // Helper to get default costs for a given date and venue
  const getDefaultCosts = (venue, dateStr) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    
    return {
      doorCost: DEFAULT_DOOR_COSTS[venue]?.[dayOfWeek] || 0,
      djCost: DEFAULT_DJ_COSTS[venue]?.[dayOfWeek] || 0,
      managerCount: DEFAULT_MANAGER_COUNTS[venue]?.[dayOfWeek] || 0
    };
  };

  // Merge Data Sources for a specific venue
  const getMergedDataForVenue = (targetVenue) => {
    // Aggregation maps
    const bookingMap = {};
    const salesMap = {};
    const timesheetMap = {};
      const guestsMap = {}; // ✅ ADDED: Track total guests per date

    // 1. Filter and Aggregate Bookings
    bookingRows.forEach(row => {
      if (row.venue === targetVenue) {
        if (!bookingMap[row.date]) bookingMap[row.date] = 0;
        bookingMap[row.date] += row.income;
        
        // ✅ ADDED: Aggregate guests
        if (!guestsMap[row.date]) guestsMap[row.date] = 0;
        guestsMap[row.date] += row.people;
      }
    });

    // 2. Filter and Aggregate Sales (POS)
    salesRows.forEach(row => {
      if (row.venue === targetVenue) {
        if (!salesMap[row.date]) salesMap[row.date] = 0;
        salesMap[row.date] += row.income;
      }
    });

    // 3. Filter and Aggregate Timesheets for this venue
    const venueTimesheets = timesheetRows[targetVenue] || [];
    venueTimesheets.forEach(row => {
      // Since we upload separate timesheet files per venue, ALL rows in this file belong to this venue
      // Include ALL staff costs (FOH, Kitchen, Managers, etc.)
      if (!timesheetMap[row.date]) timesheetMap[row.date] = { staff: 0 };
      
      // Add ALL staff costs to the total
      timesheetMap[row.date].staff += row.cost;
    });

    // 4. Get all unique dates from ALL venues to ensure consistent date range
    const allVenueDates = new Set();
    
    // Add dates from all bookings (all venues)
    bookingRows.forEach(row => allVenueDates.add(row.date));
    
    // Add dates from all sales (all venues)
    salesRows.forEach(row => allVenueDates.add(row.date));
    
    // Add dates from all timesheets (all venues)
    Object.values(timesheetRows).forEach(venueSheets => {
      venueSheets.forEach(row => allVenueDates.add(row.date));
    });
    
    // 5. Generate continuous date range from earliest to latest date across ALL venues
    let dateRange = [];
    if (allVenueDates.size > 0) {
      const dates = Array.from(allVenueDates).sort();
      const firstDate = new Date(dates[0]);
      const lastDate = new Date(dates[dates.length - 1]);
      
      // Generate all dates between first and last
      const currentDate = new Date(firstDate);
      while (currentDate <= lastDate) {
        dateRange.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return dateRange.map(date => {
      const tIncome = bookingMap[date] || 0;
      const bIncome = salesMap[date] || 0;
      const r = timesheetMap[date] || { staff: 0 };
        const guests = guestsMap[date] || 0; // ✅ ADDED: Get guests count
      
      // Get defaults for this date and venue
      const defaults = getDefaultCosts(targetVenue, date);
      
      // Get manual adjustments or use defaults
      const adjustmentKey = `${targetVenue}_${date}`;
      const m = manualAdjustments[adjustmentKey] || {};
      
      // Use manual value if set, otherwise use default
      const doorCost = m.doorCost !== undefined ? m.doorCost : defaults.doorCost;
      const djCost = m.djCost !== undefined ? m.djCost : defaults.djCost;
      
      // Auto-add 1 cleaner if there's any revenue (booking or sales)
      const hasRevenue = (tIncome + bIncome) > 0;
      const autoCleaningCount = hasRevenue ? 1 : 0;
      const cleaningCount = m.cleaningCount !== undefined ? m.cleaningCount : autoCleaningCount;
      
      const agencyHours = m.agencyHours || 0;  // Now storing hours instead of count
      const managerCount = m.managerCount !== undefined ? m.managerCount : defaults.managerCount;  // Use default if not manually set
      const transfer = m.transfer || 0;

      // Calculate Costs
      const cleanCost = cleaningCount * FINANCIALS.CLEANER_COST;
      const agencyCost = agencyHours * FINANCIALS.AGENCY_HOURLY_RATE;  // Hours × £18/hour
      const managerCost = managerCount * FINANCIALS.MANAGER_SHIFT_COST;
      
      // Employer Costs = 6.5% of (staff wages + manager wages from timesheets)
      // Note: r.staff already includes all wages from timesheets (FOH, Kitchen, Managers, etc.)
      const employerCosts = r.staff * 0.065;

      // ✅ NEWCASTLE FOOD VENDOR ADJUSTMENT
      // For Newcastle, adjust revenue to account for food vendor arrangement:
      // Revenue = Total POS Sales - Food Takings (inc VAT) + (Food Takings × 20% commission)
      // Uses actual food totals parsed from Sales Items tab - no estimation
      let totalIncome = tIncome + bIncome;
      if (targetVenue === 'newcastle') {
        const actualFoodTakingsIncVat = newcastleFoodRows[date] || 0;
        const actualFoodTakingsExVat = actualFoodTakingsIncVat / 1.2;
        // bIncome is already ex-VAT, so we deduct ex-VAT food and add back 20% commission ex-VAT
        totalIncome = tIncome + bIncome - actualFoodTakingsExVat + (actualFoodTakingsExVat * 0.20);
      }
      
      // Total Labor = Timesheets (Staff) + Employer Costs + Manual (Door+DJ+Clean+Agency+Manager) + Transfer
      const totalLabor = r.staff + employerCosts + doorCost + djCost + cleanCost + agencyCost + managerCost + transfer;
      const ratio = totalIncome > 0 ? (totalLabor / totalIncome) * 100 : 0;
      
      const dayName = new Date(date).toLocaleDateString('en-GB', { weekday: 'short' });

      return {
          date,
          dayName,
          guests, // ✅ ADDED: Include guests in returned data
        ticketIncome: tIncome,
        barIncome: bIncome,
        totalIncome,
        staff: r.staff,
        doorCost: doorCost,
        djCost: djCost,
        cleaningCount: cleaningCount,
        agencyHours: agencyHours,  // Changed from agencyCount to agencyHours
        managerCount: managerCount,
        transfer: transfer,
        
        cleanCost,
        agencyCost,
        managerCost,
        employerCosts,
        
        totalLabor,
        ratio
      };
    });
  };

  // Generate data for all venues
  const glasgowData = useMemo(() => getMergedDataForVenue('glasgow'), [bookingRows, salesRows, timesheetRows, manualAdjustments]);
  const edinburghData = useMemo(() => getMergedDataForVenue('edinburgh'), [bookingRows, salesRows, timesheetRows, manualAdjustments]);
  const newcastleData = useMemo(() => getMergedDataForVenue('newcastle'), [bookingRows, salesRows, timesheetRows, manualAdjustments]);

  // Helper component to render a venue table
  const VenueTable = React.memo(({ venueName, venueData }) => {
    if (venueData.length === 0) return null;

    // Calculate totals
    const totals = venueData.reduce((acc, row) => ({
      guests: acc.guests + row.guests, // ✅ ADDED: Sum guests
      ticketIncome: acc.ticketIncome + row.ticketIncome,
      barIncome: acc.barIncome + row.barIncome,
      totalIncome: acc.totalIncome + row.totalIncome,
      staff: acc.staff + row.staff,
      managerCost: acc.managerCost + row.managerCost,
      doorCost: acc.doorCost + row.doorCost,
      djCost: acc.djCost + row.djCost,
      cleanCost: acc.cleanCost + row.cleanCost,
      agencyCost: acc.agencyCost + row.agencyCost,
      transfer: acc.transfer + row.transfer,
      employerCosts: acc.employerCosts + row.employerCosts,
      totalLabor: acc.totalLabor + row.totalLabor
    }), {
      guests: 0, // ✅ ADDED: Initialize guests to 0
      ticketIncome: 0,
      barIncome: 0,
      totalIncome: 0,
      staff: 0,
      managerCost: 0,
      doorCost: 0,
      djCost: 0,
      cleanCost: 0,
      agencyCost: 0,
      transfer: 0,
      employerCosts: 0,
      totalLabor: 0
    });

    const overallRatio = totals.totalIncome > 0 ? (totals.totalLabor / totals.totalIncome) * 100 : 0;

    const handleExportVenuePDF = async () => {
      // Dynamically load jsPDF and autotable
      const script1 = document.createElement('script');
      script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script1);
      
      const script2 = document.createElement('script');
      script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
      document.head.appendChild(script2);
      
      // Wait for scripts to load
      await new Promise(resolve => {
        script2.onload = resolve;
      });
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
      
      const today = new Date().toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(99, 102, 241);
      doc.text(`${venueName} - Lookback Report`, 15, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated: ${today}`, 15, 22);
      
      // Summary Stats
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Summary', 15, 35);
      
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      const summaryY = 42;
      doc.text(`Total Income: £${totals.totalIncome.toFixed(0)}`, 15, summaryY);
      doc.text(`Total Labor Cost: £${totals.totalLabor.toFixed(0)}`, 80, summaryY);
      doc.text(`Labor Ratio: ${overallRatio.toFixed(1)}%`, 160, summaryY);
      
      // Data table
      const tableData = venueData.map(d => [
        d.date,
        `£${d.ticketIncome.toFixed(0)}`,
        `£${d.barIncome.toFixed(0)}`,
        `£${d.totalIncome.toFixed(0)}`,
        `£${d.staff.toFixed(0)}`,
        `£${d.managerCost.toFixed(0)}`,
        `£${d.doorCost.toFixed(0)}`,
        `£${d.djCost.toFixed(0)}`,
        `£${d.cleanCost.toFixed(0)}`,
        `£${d.agencyCost.toFixed(0)}`,
        `£${d.transfer.toFixed(0)}`,
        `£${d.employerCosts.toFixed(0)}`,
        `£${d.totalLabor.toFixed(0)}`,
        `${d.ratio.toFixed(1)}%`
      ]);
      
      // Add totals row
      tableData.push([
        'TOTALS',
          totals.guests, // ✅ ADDED: Total guests
        `£${totals.ticketIncome.toFixed(0)}`,
        `£${totals.barIncome.toFixed(0)}`,
        `£${totals.totalIncome.toFixed(0)}`,
        `£${totals.staff.toFixed(0)}`,
        `£${totals.managerCost.toFixed(0)}`,
        `£${totals.doorCost.toFixed(0)}`,
        `£${totals.djCost.toFixed(0)}`,
        `£${totals.cleanCost.toFixed(0)}`,
        `£${totals.agencyCost.toFixed(0)}`,
        `£${totals.transfer.toFixed(0)}`,
        `£${totals.employerCosts.toFixed(0)}`,
        `£${totals.totalLabor.toFixed(0)}`,
        `${overallRatio.toFixed(1)}%`
      ]);
      
      doc.autoTable({
        startY: 50,
        head: [[
          'Date', 
          'Ticket', 
          'Bar', 
          'Total Inc', 
          'Staff', 
          'Mgrs', 
          'Door', 
          'DJ', 
          'Clean', 
          'Agency', 
          'Transfer', 
          'Emp. Costs', 
          'Total Cost', 
          'Ratio %'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 16 },
            1: { cellWidth: 12, halign: 'center' }, // ✅ ADDED: Guests column styling
            2: { cellWidth: 16, halign: 'right' },
            3: { cellWidth: 16, halign: 'right' },
            4: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
            5: { cellWidth: 16, halign: 'right' },
            6: { cellWidth: 14, halign: 'right' },
            7: { cellWidth: 14, halign: 'right' },
            8: { cellWidth: 14, halign: 'right' },
            9: { cellWidth: 14, halign: 'right' },
            10: { cellWidth: 14, halign: 'right' },
            11: { cellWidth: 16, halign: 'right' },
            12: { cellWidth: 18, halign: 'right' },
            13: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
            14: { cellWidth: 16, halign: 'right', fontStyle: 'bold' }
          },
        // Style the totals row differently
        didParseCell: function(data) {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [243, 244, 246]; // gray-100
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(
          `Page ${i} of ${pageCount} | ${venueName} Lookback | Generated ${today}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
      
      // Save
      doc.save(`lookback-${venueName.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{venueName}</h2>
          <button 
            onClick={handleExportVenuePDF} 
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 hover:bg-gray-100 rounded-lg text-sm font-semibold transition-colors shadow-lg"
          >
            <FileText size={18} /> Export PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b">
              <tr>
                <th className="px-3 py-3 w-28">Date</th>
                  <th className="px-3 py-3 w-20 text-center bg-indigo-50 text-indigo-800">Guests</th>{/* ✅ ADDED: Guests column header */}
                <th className="px-3 py-3 text-right bg-blue-50/50">Ticket (Ex)</th>
                <th className="px-3 py-3 text-right bg-blue-50/50">Bar (Ex)</th>
                <th className="px-3 py-3 text-right font-bold bg-blue-100 text-blue-900 border-r border-blue-200">Total Inc</th>
                <th className="px-3 py-3 text-right">Staff</th>
                <th className="px-3 py-3 w-20 text-center bg-purple-50 text-purple-800">Mgrs</th>
                <th className="px-3 py-3 w-20 text-center bg-yellow-50 text-yellow-800">Door</th>
                <th className="px-3 py-3 w-20 text-center bg-yellow-50 text-yellow-800">DJ</th>
                <th className="px-3 py-3 w-20 text-center bg-yellow-50 text-yellow-800">Clean</th>
                <th className="px-3 py-3 w-20 text-center bg-yellow-50 text-yellow-800 border-r border-yellow-100">Agency (hrs)</th>
                <th className="px-3 py-3 w-20 text-center bg-gray-50 text-gray-600 border-r border-gray-200">Transfer</th>
                <th className="px-3 py-3 text-right bg-green-50 text-green-800">Emp. Costs</th>
                <th className="px-3 py-3 text-right font-bold bg-red-50 text-red-900">Total Cost</th>
                <th className="px-3 py-3 text-right font-bold">Ratio %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {venueData.map((row) => (
                <tr key={`${venueName}-${row.date}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium">
                    <div className="text-gray-900">{row.date}</div>
                    <div className="text-gray-400 text-[10px] uppercase">{row.dayName}</div>
                  </td>
                    {/* ✅ ADDED: Guests data cell */}
                    <td className="px-3 py-2 text-center font-bold text-indigo-700 bg-indigo-50/30">
                      {row.guests > 0 ? row.guests : '-'}
                    </td>
                  <td className="px-3 py-2 text-right">£{row.ticketIncome.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right">£{row.barIncome.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700 border-r border-gray-100">£{row.totalIncome.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">£{row.staff.toFixed(0)}</td>
                  
                  <td className="px-2 py-1 bg-purple-50/30">
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          className="w-full text-center border border-purple-200 rounded px-1 py-0.5 text-purple-700 font-bold" 
                          placeholder="0" 
                          defaultValue={row.managerCount || ''} 
                          onBlur={(e) => handleAdjustmentChange(venueName.toLowerCase(), row.date, 'managerCount', e.target.value)} 
                          key={`${venueName}-${row.date}-manager`}
                        />
                        {row.managerCost > 0 && <span className="text-[9px] text-purple-400">£{row.managerCost}</span>}
                     </div>
                  </td>

                  <td className="px-2 py-1">
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          className="w-full text-center border border-gray-200 rounded px-1 py-0.5" 
                          placeholder="£0" 
                          defaultValue={row.doorCost || ''} 
                          onBlur={(e) => handleAdjustmentChange(venueName.toLowerCase(), row.date, 'doorCost', e.target.value)} 
                          key={`${venueName}-${row.date}-door`}
                        />
                     </div>
                  </td>

                  <td className="px-2 py-1">
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          className="w-full text-center border border-gray-200 rounded px-1 py-0.5" 
                          placeholder="£0" 
                          defaultValue={row.djCost || ''} 
                          onBlur={(e) => handleAdjustmentChange(venueName.toLowerCase(), row.date, 'djCost', e.target.value)} 
                          key={`${venueName}-${row.date}-dj`}
                        />
                     </div>
                  </td>

                  <td className="px-2 py-1">
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          className="w-full text-center border border-gray-200 rounded px-1 py-0.5" 
                          placeholder="0" 
                          defaultValue={row.cleaningCount || ''} 
                          onBlur={(e) => handleAdjustmentChange(venueName.toLowerCase(), row.date, 'cleaningCount', e.target.value)} 
                          key={`${venueName}-${row.date}-clean`}
                        />
                        {row.cleanCost > 0 && <span className="text-[9px] text-gray-400">£{row.cleanCost}</span>}
                     </div>
                  </td>

                  <td className="px-2 py-1">
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          className="w-full text-center border border-gray-200 rounded px-1 py-0.5" 
                          placeholder="0" 
                          defaultValue={row.agencyHours || ''} 
                          onBlur={(e) => handleAdjustmentChange(venueName.toLowerCase(), row.date, 'agencyHours', e.target.value)} 
                          key={`${venueName}-${row.date}-agency`}
                        />
                        {row.agencyCost > 0 && <span className="text-[9px] text-gray-400">£{row.agencyCost}</span>}
                     </div>
                  </td>

                  <td className="px-2 py-1 border-r border-gray-100">
                    <input 
                      type="number" 
                      className="w-full text-right border border-gray-200 rounded px-1 py-0.5" 
                      placeholder="£0" 
                      defaultValue={row.transfer || ''} 
                      onBlur={(e) => handleAdjustmentChange(venueName.toLowerCase(), row.date, 'transfer', e.target.value)} 
                      key={`${venueName}-${row.date}-transfer`}
                    />
                  </td>

                  <td className="px-3 py-2 text-right text-green-700 bg-green-50/30">£{row.employerCosts.toFixed(0)}</td>

                  <td className="px-3 py-2 text-right font-bold text-red-700 bg-red-50/30">£{row.totalLabor.toFixed(0)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${row.ratio > 30 ? 'text-red-600' : 'text-green-600'}`}>
                    {row.ratio.toFixed(1)}%
                  </td>
                </tr>
              ))}
              
              {/* TOTALS ROW */}
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                <td className="px-3 py-3 text-gray-900">TOTALS</td>
                  <td className="px-3 py-3 text-center bg-indigo-100 text-indigo-900">{totals.guests}</td>{/* ✅ ADDED: Total guests */}
                <td className="px-3 py-3 text-right text-gray-900">£{totals.ticketIncome.toFixed(0)}</td>
                <td className="px-3 py-3 text-right text-gray-900">£{totals.barIncome.toFixed(0)}</td>
                <td className="px-3 py-3 text-right font-bold text-blue-900 border-r border-gray-300">£{totals.totalIncome.toFixed(0)}</td>
                <td className="px-3 py-3 text-right text-gray-900">£{totals.staff.toFixed(0)}</td>
                <td className="px-3 py-3 text-center bg-purple-100 text-purple-900">£{totals.managerCost.toFixed(0)}</td>
                <td className="px-3 py-3 text-center bg-yellow-100 text-yellow-900">£{totals.doorCost.toFixed(0)}</td>
                <td className="px-3 py-3 text-center bg-yellow-100 text-yellow-900">£{totals.djCost.toFixed(0)}</td>
                <td className="px-3 py-3 text-center bg-yellow-100 text-yellow-900">£{totals.cleanCost.toFixed(0)}</td>
                <td className="px-3 py-3 text-center bg-yellow-100 text-yellow-900 border-r border-yellow-200">£{totals.agencyCost.toFixed(0)}</td>
                <td className="px-3 py-3 text-center border-r border-gray-300">£{totals.transfer.toFixed(0)}</td>
                <td className="px-3 py-3 text-right text-green-900 bg-green-100">£{totals.employerCosts.toFixed(0)}</td>
                <td className="px-3 py-3 text-right font-bold text-red-900 bg-red-100">£{totals.totalLabor.toFixed(0)}</td>
                <td className={`px-3 py-3 text-right font-bold text-lg ${overallRatio > 30 ? 'text-red-600' : 'text-green-600'}`}>
                  {overallRatio.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  });
  VenueTable.displayName = 'VenueTable';

  return (
    <div className="space-y-6">
      {/* Shared Uploads Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold text-blue-900 mb-4">📤 Shared Uploads (All Venues)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Users size={18} className="text-indigo-600"/> 1. Bookings (CSV)</h3>
            <p className="text-xs text-gray-500 mb-3">Booked.it Export - All Venues</p>
            <input type="file" accept=".csv" onChange={handleBookingUpload} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><DollarSign size={18} className="text-green-600"/> 2. Sales (Excel/CSV)</h3>
            <p className="text-xs text-gray-500 mb-3">SumUp POS Export - All Venues</p>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleSalesUpload} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
          </div>
        </div>
      </div>

      {/* Venue-Specific Timesheet Uploads */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold text-orange-900 mb-4">📋 Timesheets (Venue-Specific)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><History size={18} className="text-orange-600"/> Glasgow</h3>
            <p className="text-xs text-gray-500 mb-3">Timesheet CSV</p>
            <input type="file" accept=".csv" onChange={handleTimesheetUpload('glasgow')} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><History size={18} className="text-orange-600"/> Edinburgh</h3>
            <p className="text-xs text-gray-500 mb-3">Timesheet CSV</p>
            <input type="file" accept=".csv" onChange={handleTimesheetUpload('edinburgh')} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><History size={18} className="text-orange-600"/> Newcastle</h3>
            <p className="text-xs text-gray-500 mb-3">Timesheet CSV</p>
            <input type="file" accept=".csv" onChange={handleTimesheetUpload('newcastle')} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
          </div>
        </div>
      </div>

      {/* Export All Button */}
      {(glasgowData.length > 0 || edinburghData.length > 0 || newcastleData.length > 0) && (
        <div className="flex justify-end mb-4">
          <button 
            onClick={async () => {
              // Export each venue that has data
              const venues = [
                { name: 'Glasgow', data: glasgowData },
                { name: 'Edinburgh', data: edinburghData },
                { name: 'Newcastle', data: newcastleData }
              ].filter(v => v.data.length > 0);
              
              for (const venue of venues) {
                // Find the VenueTable component and trigger its export
                // We'll create a combined PDF instead
              }
              
              // Load jsPDF
              const script1 = document.createElement('script');
              script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
              document.head.appendChild(script1);
              
              const script2 = document.createElement('script');
              script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
              document.head.appendChild(script2);
              
              await new Promise(resolve => { script2.onload = resolve; });
              
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF('l', 'mm', 'a4');
              
              const today = new Date().toLocaleDateString('en-GB', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              });
              
              let isFirstVenue = true;
              
              for (const venue of venues) {
                if (!isFirstVenue) {
                  doc.addPage();
                }
                isFirstVenue = false;
                
                // Calculate totals for this venue
                const totals = venue.data.reduce((acc, row) => ({
                  ticketIncome: acc.ticketIncome + row.ticketIncome,
                  barIncome: acc.barIncome + row.barIncome,
                  totalIncome: acc.totalIncome + row.totalIncome,
                  staff: acc.staff + row.staff,
                  managerCost: acc.managerCost + row.managerCost,
                  doorCost: acc.doorCost + row.doorCost,
                  djCost: acc.djCost + row.djCost,
                  cleanCost: acc.cleanCost + row.cleanCost,
                  agencyCost: acc.agencyCost + row.agencyCost,
                  transfer: acc.transfer + row.transfer,
                  employerCosts: acc.employerCosts + row.employerCosts,
                  totalLabor: acc.totalLabor + row.totalLabor
                }), {
                  ticketIncome: 0, barIncome: 0, totalIncome: 0, staff: 0,
                  managerCost: 0, doorCost: 0, djCost: 0, cleanCost: 0,
                  agencyCost: 0, transfer: 0, employerCosts: 0, totalLabor: 0
                });
                
                const overallRatio = totals.totalIncome > 0 ? (totals.totalLabor / totals.totalIncome) * 100 : 0;
                
                // Header
                doc.setFontSize(18);
                doc.setTextColor(99, 102, 241);
                doc.text(`${venue.name} - Lookback Report`, 15, 15);
                
                doc.setFontSize(10);
                doc.setTextColor(107, 114, 128);
                doc.text(`Generated: ${today}`, 15, 22);
                
                // Summary
                doc.setFontSize(14);
                doc.setTextColor(0, 0, 0);
                doc.text('Summary', 15, 35);
                
                doc.setFontSize(10);
                doc.setTextColor(107, 114, 128);
                doc.text(`Total Income: £${totals.totalIncome.toFixed(0)}`, 15, 42);
                doc.text(`Total Labor: £${totals.totalLabor.toFixed(0)}`, 80, 42);
                doc.text(`Ratio: ${overallRatio.toFixed(1)}%`, 160, 42);
                
                // Table
                const tableData = venue.data.map(d => [
                  d.date,
                  `£${d.ticketIncome.toFixed(0)}`,
                  `£${d.barIncome.toFixed(0)}`,
                  `£${d.totalIncome.toFixed(0)}`,
                  `£${d.staff.toFixed(0)}`,
                  `£${d.managerCost.toFixed(0)}`,
                  `£${d.doorCost.toFixed(0)}`,
                  `£${d.djCost.toFixed(0)}`,
                  `£${d.cleanCost.toFixed(0)}`,
                  `£${d.agencyCost.toFixed(0)}`,
                  `£${d.transfer.toFixed(0)}`,
                  `£${d.employerCosts.toFixed(0)}`,
                  `£${d.totalLabor.toFixed(0)}`,
                  `${d.ratio.toFixed(1)}%`
                ]);
                
                tableData.push([
                  'TOTALS',
                  `£${totals.ticketIncome.toFixed(0)}`,
                  `£${totals.barIncome.toFixed(0)}`,
                  `£${totals.totalIncome.toFixed(0)}`,
                  `£${totals.staff.toFixed(0)}`,
                  `£${totals.managerCost.toFixed(0)}`,
                  `£${totals.doorCost.toFixed(0)}`,
                  `£${totals.djCost.toFixed(0)}`,
                  `£${totals.cleanCost.toFixed(0)}`,
                  `£${totals.agencyCost.toFixed(0)}`,
                  `£${totals.transfer.toFixed(0)}`,
                  `£${totals.employerCosts.toFixed(0)}`,
                  `£${totals.totalLabor.toFixed(0)}`,
                  `${overallRatio.toFixed(1)}%`
                ]);
                
                doc.autoTable({
                  startY: 50,
                  head: [[
                    'Date', 'Ticket', 'Bar', 'Total Inc', 'Staff', 'Mgrs', 
                    'Door', 'DJ', 'Clean', 'Agency', 'Transfer', 'Emp. Costs', 
                    'Total Cost', 'Ratio %'
                  ]],
                  body: tableData,
                  theme: 'grid',
                  headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 8 },
                  styles: { fontSize: 7, cellPadding: 1.5 },
                  columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 18, halign: 'right' },
                    2: { cellWidth: 18, halign: 'right' },
                    3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                    4: { cellWidth: 18, halign: 'right' },
                    5: { cellWidth: 16, halign: 'right' },
                    6: { cellWidth: 16, halign: 'right' },
                    7: { cellWidth: 16, halign: 'right' },
                    8: { cellWidth: 16, halign: 'right' },
                    9: { cellWidth: 16, halign: 'right' },
                    10: { cellWidth: 18, halign: 'right' },
                    11: { cellWidth: 20, halign: 'right' },
                    12: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                    13: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }
                  },
                  didParseCell: function(data) {
                    if (data.row.index === tableData.length - 1) {
                      data.cell.styles.fillColor = [243, 244, 246];
                      data.cell.styles.fontStyle = 'bold';
                    }
                  }
                });
              }
              
              // Footers
              const pageCount = doc.internal.getNumberOfPages();
              for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(156, 163, 175);
                doc.text(
                  `Page ${i} of ${pageCount} | All Venues Lookback | Generated ${today}`,
                  doc.internal.pageSize.width / 2,
                  doc.internal.pageSize.height - 10,
                  { align: 'center' }
                );
              }
              
              doc.save(`lookback-all-venues-${new Date().toISOString().split('T')[0]}.pdf`);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all"
          >
            <FileText size={20} /> Export All Venues PDF
          </button>
        </div>
      )}

      {/* Venue Tables */}
      <VenueTable venueName="Glasgow" venueData={glasgowData} />
      <VenueTable venueName="Edinburgh" venueData={edinburghData} />
      <VenueTable venueName="Newcastle" venueData={newcastleData} />
    </div>
  );
};

// ============================================================================
// NEWCASTLE FOOD VENDOR REPORT
// ============================================================================

const NewcastleFoodVendorReport = () => {
  const [file, setFile] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const POPCORN_WHITE = '#fdfee9';
  const GLASGA_RED = '#f30050';
  const BUCKY_GREEN = '#0ec981';

  const isFoodToken = (row, headers) => {
    const categoryIdx = headers.findIndex(h => h?.toLowerCase().includes('category'));
    const lineDiscountIdx = headers.findIndex(h => h?.toLowerCase().includes('line discount'));
    const saleDiscountIdx = headers.findIndex(h => h?.toLowerCase().includes('sale discount'));
    const unitPriceIdx = headers.findIndex(h => h?.toLowerCase().includes('unit price'));
    const quantityIdx = headers.findIndex(h => h?.toLowerCase().includes('quantity'));

    if (categoryIdx === -1) return false;

    const category = String(row[categoryIdx] || '');
    if (!category.substring(0, 4).toLowerCase().includes('food')) {
      return false;
    }

    const lineDiscount = parseFloat(row[lineDiscountIdx]) || 0;
    const saleDiscount = parseFloat(row[saleDiscountIdx]) || 0;
    const unitPrice = parseFloat(row[unitPriceIdx]) || 0;
    const quantity = parseFloat(row[quantityIdx]) || 0;

    const totalDiscount = lineDiscount + saleDiscount;
    const totalPrice = unitPrice * quantity;

    return Math.abs(totalDiscount - totalPrice) < 0.01;
  };

  const processData = async () => {
    if (!file) {
      setError('Please upload a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // STEP 1: Parse SALES tab to get Sale ID → Outlet mapping
        let salesSheet = wb.Sheets['Sales'];
        if (!salesSheet) {
          // Try first sheet if 'Sales' not found
          salesSheet = wb.Sheets[wb.SheetNames[0]];
        }
        
        const salesData = XLSX.utils.sheet_to_json(salesSheet, { header: 1, defval: '' });
        let salesHeaderIndex = 0;
        for(let i=0; i<salesData.length; i++) {
          const row = salesData[i];
          if (Array.isArray(row) && row.some(cell => String(cell).toLowerCase().includes('sale id'))) {
            salesHeaderIndex = i;
            break;
          }
        }
        
        const salesHeaders = salesData[salesHeaderIndex];
        const salesRows = salesData.slice(salesHeaderIndex + 1);
        
        const saleIdIdx = salesHeaders.findIndex(h => String(h).toLowerCase().includes('sale id'));
        const outletIdx = salesHeaders.findIndex(h => String(h).toLowerCase().includes('outlet'));
        const saleDateIdx = salesHeaders.findIndex(h => String(h).toLowerCase().includes('sale date'));
        
        if (saleIdIdx === -1 || outletIdx === -1) {
          throw new Error('Sales tab missing required columns: Sale ID, Outlet');
        }
        
        // Build map: Sale ID → { outlet, date }
        const saleIdMap = {};
        salesRows.forEach(row => {
          if (!row || row.length === 0) return;
          const saleId = String(row[saleIdIdx] || '').trim();
          const outlet = String(row[outletIdx] || '').toLowerCase();
          const saleDate = row[saleDateIdx];
          
          if (saleId && outlet) {
            saleIdMap[saleId] = { outlet, date: saleDate };
          }
        });
        
        console.log('Sales tab parsed:', Object.keys(saleIdMap).length, 'sale IDs');
        
        // STEP 2: Parse SALES ITEMS tab for food items
        let itemsSheet = wb.Sheets['Sales Items'];
        if (!itemsSheet) {
          // Look for sheet with "item" in name
          const itemSheetName = wb.SheetNames.find(name => name.toLowerCase().includes('item'));
          if (itemSheetName) {
            itemsSheet = wb.Sheets[itemSheetName];
          }
        }
        
        if (!itemsSheet) {
          throw new Error('Could not find Sales Items sheet. Please ensure your export includes both Sales and Sales Items tabs.');
        }
        
        const itemsData = XLSX.utils.sheet_to_json(itemsSheet, { header: 1, defval: '' });
        let itemsHeaderIndex = 0;
        for(let i=0; i<itemsData.length; i++) {
          const row = itemsData[i];
          if (Array.isArray(row) && row.some(cell => String(cell).toLowerCase().includes('category'))) {
            itemsHeaderIndex = i;
            break;
          }
        }

        const itemsHeaders = itemsData[itemsHeaderIndex];
        const itemsRows = itemsData.slice(itemsHeaderIndex + 1);

        const itemSaleIdIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('sale id'));
        const categoryIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('category'));
        const productNameIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('product name'));
        const quantityIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('quantity'));
        const totalIdx = itemsHeaders.findIndex(h => String(h).toLowerCase().includes('total'));

        if (itemSaleIdIdx === -1 || categoryIdx === -1 || quantityIdx === -1 || totalIdx === -1) {
          throw new Error('Sales Items tab missing required columns: Sale ID, Category, Quantity, Total');
        }

        if (productNameIdx === -1) {
          throw new Error('Sales Items tab missing "Product Name" column');
        }

        const itemSales = {};
        const dailySales = {}; // NEW: Track sales by date
        let earliestDate = null;
        let latestDate = null;
        let totalTokens = 0;
        let totalCardSales = 0;
        let newcastleItemsFound = 0;
        let foodItemsFound = 0;

        itemsRows.forEach(row => {
          if (!row || row.length === 0) return;

          // Get Sale ID and lookup outlet
          const saleId = String(row[itemSaleIdIdx] || '').trim();
          const saleInfo = saleIdMap[saleId];
          
          if (!saleInfo) return; // Sale ID not found in Sales tab
          
          // Filter for Newcastle only
          if (!saleInfo.outlet.includes('newcastle')) return;
          newcastleItemsFound++;
          
          // Check if it's a food item
          const category = String(row[categoryIdx] || '');
          if (!category.substring(0, 4).toLowerCase().includes('food')) return;
          foodItemsFound++;

          const productName = row[productNameIdx] || category;
          const quantity = parseFloat(row[quantityIdx]) || 0;
          
          // Check if this is explicitly non-token food
          const isNonTokenFood = category.toLowerCase().includes('non-token');
          
          // Only apply token detection if NOT explicitly marked as non-token
          const isToken = !isNonTokenFood && isFoodToken(row, itemsHeaders);
          const value = isToken ? (10 * quantity) : (parseFloat(row[totalIdx]) || 0);

          // Track dates from sale info
          let dateKey = null;
          if (saleInfo.date) {
            const date = new Date(saleInfo.date);
            if (!isNaN(date)) {
              if (!earliestDate || date < earliestDate) earliestDate = date;
              if (!latestDate || date > latestDate) latestDate = date;
              dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            }
          }

          if (isToken) {
            totalTokens += quantity * 10;  // Each token is £10
          } else {
            totalCardSales += value;
          }

          // Aggregate by product (overall)
          if (!itemSales[productName]) {
            itemSales[productName] = { quantity: 0, total: 0, isToken: isToken };
          }
          itemSales[productName].quantity += quantity;
          itemSales[productName].total += value;

          // NEW: Aggregate by date and product
          if (dateKey) {
            if (!dailySales[dateKey]) {
              dailySales[dateKey] = {};
            }
            if (!dailySales[dateKey][productName]) {
              dailySales[dateKey][productName] = { quantity: 0, total: 0 };
            }
            dailySales[dateKey][productName].quantity += quantity;
            dailySales[dateKey][productName].total += value;
          }
        });

        console.log('Newcastle items found:', newcastleItemsFound);
        console.log('Food items found:', foodItemsFound);
        console.log('Days with sales:', Object.keys(dailySales).length);

        if (foodItemsFound === 0) {
          throw new Error(`No food items found for Newcastle. Found ${newcastleItemsFound} Newcastle items total, but none were categorized as Food.`);
        }

        const salesArray = Object.entries(itemSales).map(([product, data]) => ({
          item: product,
          quantity: data.quantity,
          total: data.total
        })).sort((a, b) => b.total - a.total);

        // NEW: Convert daily sales to array format
        const dailyBreakdown = Object.entries(dailySales).map(([date, products]) => {
          const itemsArray = Object.entries(products).map(([product, data]) => ({
            item: product,
            quantity: data.quantity,
            total: data.total
          })).sort((a, b) => b.quantity - a.quantity); // Sort by quantity sold

          const dayTotal = itemsArray.reduce((sum, item) => sum + item.total, 0);
          
          return {
            date,
            items: itemsArray,
            dayTotal
          };
        }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically

        const totalFoodTakings = totalTokens + totalCardSales;
        const vendorPayment = totalFoodTakings * 0.80;
        const commission = totalFoodTakings * 0.20;

        setReportData({
          sales: salesArray,
          dailyBreakdown, // NEW: Daily breakdown data
          totalFoodTakings,
          vendorPayment,
          commission,
          totalTokens,
          totalCardSales,
          weekStart: earliestDate,
          weekEnd: latestDate
        });
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError(`Error processing file: ${err.message}`);
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!reportData) return;

    try {
      // Check if jsPDF is already loaded
      if (!window.jspdf) {
        const script1 = document.createElement('script');
        script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        document.head.appendChild(script1);
        
        await new Promise((resolve, reject) => {
          script1.onload = resolve;
          script1.onerror = reject;
        });
        
        const script2 = document.createElement('script');
        script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
        document.head.appendChild(script2);
        
        await new Promise((resolve, reject) => {
          script2.onload = resolve;
          script2.onerror = reject;
        });
        
        // Give it a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const { jsPDF } = window.jspdf;
      
      if (!jsPDF) {
        throw new Error('jsPDF failed to load. Please refresh and try again.');
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Hook into jsPDF's internal addPage to ALWAYS set background
      const originalAddPage = doc.addPage;
      doc.addPage = function(...args) {
        const result = originalAddPage.apply(this, args);
        // Set popcorn white background on newly added page
        this.setFillColor(253, 254, 233);
        this.rect(0, 0, pageWidth, pageHeight, 'F');
        return result;
      };

      // Set background on first page
      doc.setFillColor(253, 254, 233);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFontSize(24);
      doc.setTextColor(243, 0, 80);
      doc.setFont('helvetica', 'bold');
      doc.text('FAYRE PLAY', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Newcastle Food Vendor Weekly Report', pageWidth / 2, 30, { align: 'center' });

      if (reportData.weekStart && reportData.weekEnd) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const weekText = `Week: ${reportData.weekStart.toLocaleDateString('en-GB')} - ${reportData.weekEnd.toLocaleDateString('en-GB')}`;
        doc.text(weekText, pageWidth / 2, 38, { align: 'center' });
      }

      let currentY = 48;

      // FINANCIAL SUMMARY - first
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Financial Summary', 15, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const summaryLines = [
        { label: 'Food Card Sales:', value: `£${reportData.totalCardSales.toFixed(2)}`, bold: false, color: null },
        { label: 'Food Token Sales:', value: `£${reportData.totalTokens.toFixed(2)}`, bold: false, color: null },
        { label: 'Total Food Takings (inc VAT):', value: `£${reportData.totalFoodTakings.toFixed(2)}`, bold: true, color: [0, 0, 0] },
        { label: 'Vendor Payment (80%):', value: `£${reportData.vendorPayment.toFixed(2)}`, bold: true, color: [14, 201, 129] },
        { label: 'Commission (20%):', value: `£${reportData.commission.toFixed(2)}`, bold: true, color: [243, 0, 80] },
      ];

      summaryLines.forEach((line, idx) => {
        if (line.bold) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
        }
        if (line.color) {
          doc.setTextColor(...line.color);
        } else {
          doc.setTextColor(80, 80, 80);
        }
        doc.text(line.label, 15, currentY);
        doc.text(line.value, pageWidth - 15, currentY, { align: 'right' });
        currentY += 7;
      });

      currentY += 8;

      // DAILY BREAKDOWN SECTION
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Daily Breakdown', 15, currentY);
      currentY += 5;

      if (reportData.dailyBreakdown && reportData.dailyBreakdown.length > 0) {
        reportData.dailyBreakdown.forEach((day, dayIdx) => {
          // Check if we need a new page
          if (currentY > pageHeight - 40) {
            doc.addPage();
            doc.setFillColor(253, 254, 233);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            currentY = 20;
          }
          const dayDate = new Date(day.date);
          const dayName = dayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

          // Day header
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(243, 0, 80);
          doc.text(`${dayName} - £${day.dayTotal.toFixed(2)}`, 15, currentY);
          currentY += 3;

          // Items table for this day
          const dayTableData = day.items.map(item => [
            item.item,
            item.quantity.toString(),
            `£${item.total.toFixed(2)}`
          ]);

          doc.autoTable({
            startY: currentY,
            head: [['Item', 'Qty', 'Total']],
            body: dayTableData,
            theme: 'plain',
            headStyles: {
              fillColor: [243, 0, 80],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8
            },
            styles: {
              fontSize: 8,
              cellPadding: 1.5,
              fillColor: [253, 254, 233]
            },
            alternateRowStyles: {
              fillColor: [253, 254, 233]
            },
            columnStyles: {
              0: { cellWidth: 120 },
              1: { halign: 'center', cellWidth: 25 },
              2: { halign: 'right', cellWidth: 30 }
            },
            margin: { left: 20 },
            didAddPage: (data) => {
              // Draw background FIRST on new pages
              doc.setFillColor(253, 254, 233);
              doc.rect(0, 0, pageWidth, pageHeight, 'F');
            }
          });

          currentY = doc.lastAutoTable.finalY + 5;
        });
      }

      currentY += 5;

      // Check if we need a new page for summary
      if (currentY > pageHeight - 80) {
        doc.addPage();
        doc.setFillColor(253, 254, 233);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        currentY = 20;
      }

      // WEEKLY SUMMARY SECTION
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Weekly Summary - All Items', 15, currentY);
      currentY += 5;

      const tableData = reportData.sales.map(item => [
        item.item,
        item.quantity.toString(),
        `£${item.total.toFixed(2)}`
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Item', 'Total Qty', 'Total (inc VAT)']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [14, 201, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          fillColor: [253, 254, 233]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 225]
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { halign: 'center', cellWidth: 40 },
          2: { halign: 'right', cellWidth: 40 }
        },
        didAddPage: (data) => {
          // Draw background FIRST on new pages
          doc.setFillColor(253, 254, 233);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
        }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // Footer on last page
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Generated by Fayre Play Newcastle Food Vendor Report', pageWidth / 2, pageHeight - 10, { align: 'center' });

      const weekStart = reportData.weekStart ? reportData.weekStart.toLocaleDateString('en-GB').replace(/\//g, '-') : 'unknown';
      doc.save(`Food_Vendor_Report_${weekStart}.pdf`);
      
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Error generating PDF: ' + err.message + '. Please refresh the page and try again.');
    }
  };

  return (
    <div style={{ backgroundColor: POPCORN_WHITE, minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          background: `linear-gradient(135deg, ${GLASGA_RED} 0%, ${BUCKY_GREEN} 100%)`,
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <FileText size={40} />
            <div>
              <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>Newcastle Food Vendor Report</h1>
              <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>Weekly sales breakdown and commission calculation</p>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '2px dashed #0ec981',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <Upload size={48} style={{ color: BUCKY_GREEN, margin: '0 auto 20px' }} />
          <h3 style={{ marginBottom: '10px' }}>Upload POS Sales Report</h3>
          <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
            Upload your weekly SumUp POS export (Excel format)
          </p>
          
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setReportData(null);
              setError(null);
            }}
            style={{ display: 'none' }}
            id="food-vendor-file-upload"
          />
          <label
            htmlFor="food-vendor-file-upload"
            style={{
              display: 'inline-block',
              backgroundColor: BUCKY_GREEN,
              color: 'white',
              padding: '12px 30px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              border: 'none'
            }}
          >
            Choose File
          </label>

          {file && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#e8f5e9',
              borderRadius: '8px',
              border: '1px solid #0ec981'
            }}>
              <p style={{ margin: 0, color: '#2e7d32' }}>✓ {file.name}</p>
            </div>
          )}

          {file && (
            <button
              onClick={processData}
              disabled={loading}
              style={{
                marginTop: '20px',
                backgroundColor: GLASGA_RED,
                color: 'white',
                padding: '12px 30px',
                borderRadius: '8px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Processing...' : 'Generate Report'}
            </button>
          )}

          {error && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#ffebee',
              borderRadius: '8px',
              border: '1px solid #f30050',
              color: '#c62828'
            }}>
              {error}
            </div>
          )}
        </div>

        {reportData && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Report Preview</h2>
              <button
                onClick={generatePDF}
                style={{
                  backgroundColor: GLASGA_RED,
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={20} />
                Download PDF
              </button>
            </div>

            {reportData.weekStart && reportData.weekEnd && (
              <div style={{
                backgroundColor: '#e3f2fd',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Calendar size={20} style={{ color: '#1976d2' }} />
                <span style={{ fontWeight: 'bold' }}>
                  Week: {reportData.weekStart.toLocaleDateString('en-GB')} - {reportData.weekEnd.toLocaleDateString('en-GB')}
                </span>
              </div>
            )}

            {/* FINANCIAL SUMMARY - shown first */}
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '20px',
              borderRadius: '8px',
              border: '2px solid #e0e0e0',
              marginBottom: '30px'
            }}>
              <h3 style={{ marginTop: 0 }}>💰 Financial Summary</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Food Card Sales:</span>
                  <span style={{ fontWeight: 'bold' }}>£{reportData.totalCardSales.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Food Token Sales:</span>
                  <span style={{ fontWeight: 'bold' }}>£{reportData.totalTokens.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '2px solid #ccc',
                  fontSize: '18px'
                }}>
                  <span style={{ fontWeight: 'bold' }}>Total Food Takings (inc VAT):</span>
                  <span style={{ fontWeight: 'bold' }}>£{reportData.totalFoodTakings.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '15px',
                  marginTop: '5px',
                  fontSize: '18px',
                  color: BUCKY_GREEN
                }}>
                  <span style={{ fontWeight: 'bold' }}>Vendor Payment (80%):</span>
                  <span style={{ fontWeight: 'bold' }}>£{reportData.vendorPayment.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '18px',
                  color: GLASGA_RED
                }}>
                  <span style={{ fontWeight: 'bold' }}>Your Commission (20%):</span>
                  <span style={{ fontWeight: 'bold' }}>£{reportData.commission.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* DAILY BREAKDOWN */}
            {reportData.dailyBreakdown && reportData.dailyBreakdown.length > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: GLASGA_RED, marginBottom: '15px' }}>📅 Daily Breakdown</h3>
                {reportData.dailyBreakdown.map((day, dayIdx) => {
                  const dayDate = new Date(day.date);
                  const dayName = dayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
                  
                  return (
                    <div key={dayIdx} style={{
                      backgroundColor: dayIdx % 2 === 0 ? '#f9f9f9' : 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                        paddingBottom: '10px',
                        borderBottom: '2px solid ' + GLASGA_RED
                      }}>
                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{dayName}</span>
                        <span style={{ fontWeight: 'bold', fontSize: '16px', color: BUCKY_GREEN }}>
                          £{day.dayTotal.toFixed(2)}
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px' }}>Item</th>
                            <th style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>Qty</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.items.map((item, itemIdx) => (
                            <tr key={itemIdx}>
                              <td style={{ padding: '6px', fontSize: '13px' }}>{item.item}</td>
                              <td style={{ padding: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                                {item.quantity}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right', fontSize: '13px' }}>
                                £{item.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* WEEKLY SUMMARY TABLE */}
            <h3 style={{ color: BUCKY_GREEN, marginBottom: '15px' }}>📊 Weekly Summary - All Items</h3>
            <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: BUCKY_GREEN, color: 'white' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Item</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Total Quantity</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Total (inc VAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.sales.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{item.item}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>£{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '25px',
          border: '1px solid #e0e0e0'
        }}>
          <h3 style={{ marginTop: 0, color: GLASGA_RED }}>How to Use</h3>
          <ol style={{ lineHeight: '1.8', color: '#555' }}>
            <li>Export your weekly POS sales report from SumUp (Excel format)</li>
            <li><strong>Important:</strong> Ensure your export includes BOTH the "Sales" and "Sales Items" tabs</li>
            <li>Upload the file using the button above</li>
            <li>Click "Generate Report" to process the data</li>
            <li>Review the preview and download the PDF report</li>
          </ol>
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fff3e0',
            borderRadius: '8px',
            border: '1px solid #ff6f00'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
              <strong>💡 How it works:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
              <li>Reads <strong>Sales</strong> tab to identify Newcastle transactions</li>
              <li>Reads <strong>Sales Items</strong> tab to get food product details</li>
              <li>Matches by Sale ID to filter Newcastle food only</li>
              <li>Uses <strong>Product Name</strong> column for item names</li>
              <li>Detects tokens: items with full discount = £10 value × quantity</li>
              <li>Excludes <strong>"Food -&gt; Non-token food"</strong> from token detection</li>
              <li>All non-token food items use actual sale value from Total column</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Glasgow14DayForecast = () => {
  const [user, setUser] = useState(null);
  const [venue, setVenue] = useState('glasgow');
  const [mode, setMode] = useState('forecast');
  const [activeView, setActiveView] = useState('forecast'); // 'forecast', 'lookback', or 'food-vendor'
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
      
      // -- VENUE FILTERING --
      const dayData = rawData.find(d => d.dateKey === dateKey && d.venue.includes(venue));
      
      const regularCovers = dayData ? dayData.regularCovers : 0;
      const largeGroupCovers = dayData ? dayData.largeGroupCovers : 0;
      
      // IMPORTANT: Use the pre-calculated revenue from CSV parser (handles Game Ticket vs Amount logic)
      const bookedRevenue = dayData ? dayData.bookedRevenue : 0; 
      
      const currentCovers = regularCovers + largeGroupCovers;

      const daysOut = Math.floor((iterDate - today) / (1000 * 60 * 60 * 24));
      const dayOfWeek = iterDate.getDay(); 
      const isPast = daysOut < 0;

      // 2. Multiplier (Applied to Regular Covers ONLY)
      const baseMults = getMultipliers(venue, dayOfWeek);
      let multiplier = getMultiplierForDaysOut(baseMults, Math.max(0, daysOut));
      
      // Weather adjustment (additive, not multiplicative)
      let weatherAdjust = 0;
      let dayWeather = null;
      if (weatherData && weatherData[dateKey]) {
        dayWeather = weatherData[dateKey];
        // Rain: small reduction
        if (dayWeather.rain > 5) weatherAdjust -= 0.05;
        if (dayWeather.rain > 10) weatherAdjust -= 0.10;
        // Good weather: small increase
        if (dayWeather.temp > 18 && dayWeather.rain < 2) weatherAdjust += 0.15;
      }
      
      // Apply weather adjustment and enforce minimum of 1.1
      const finalMult = isPast ? 1.0 : Math.max(1.1, multiplier + weatherAdjust);

      // 3. Forecast Logic
      let projectedRegular = Math.round(regularCovers * finalMult);
      let rawForecast = projectedRegular + largeGroupCovers;
      
      const cap = VENUES[venue].capacity;
      
      // LOGIC FIX: Always respect actual bookings if they exceed capacity
      let forecastCovers = rawForecast;
      let wasCapped = false;

      if (currentCovers > cap) {
         forecastCovers = currentCovers;
      } else if (forecastCovers > cap) {
         forecastCovers = cap;
         wasCapped = true;
      }

      // 4. REVENUE CALCULATION (BOOKED + WALK-IN)
      // Calculate how many covers are "walk-ins" (projected beyond current bookings)
      const walkInCovers = Math.max(0, forecastCovers - currentCovers);
      
      const standardAvgSpend = FINANCIALS.REVENUE_PER_COVER[venue] || 25.00;
      const walkInRevenue = walkInCovers * standardAvgSpend;
      
      const revenue = bookedRevenue + walkInRevenue;
      
      // Avg Spend for display only
      const avgSpend = forecastCovers > 0 ? (revenue / forecastCovers) : 0;

      // 5. BUDGET & HOURS CALCULATION
      // Budget = 25% of revenue (target labor ratio)
      const minDailyBudget = MINIMUM_DAILY_BUDGETS[venue] ? (MINIMUM_DAILY_BUDGETS[venue][dayOfWeek] || 131) : 131;
      const incomeBasedBudget = revenue * (FINANCIALS.TARGET_LABOR_PCT / 100); // 25% of revenue
      const maxDailyBudget = 2000; // Maximum daily budget cap
      const budget = Math.min(Math.max(incomeBasedBudget, minDailyBudget), maxDailyBudget);

      // Step B: Calculate Staff Hours based on Budget
      const staffHours = Math.round(budget / FINANCIALS.BUDGET_DIVISOR);

      // Step C: Labor Cost
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
        bookedRevenue, 
        
        multiplier: finalMult,
        forecastCovers,
        wasCapped,
        
        staffHours,
        revenue,
        avgSpend,
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
  // ROBUST CSV PARSER (FORECAST)
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
      
      // UPDATED: Prioritize "Event date" for arrival date, fallback to "date"
      // When both exist, "Event date" is the actual arrival, "date" is booking creation
      let idxDate = headers.findIndex(h => h === 'event date');
      if (idxDate === -1) idxDate = headers.indexOf('date');
      if (idxDate === -1) idxDate = headers.findIndex(h => h.includes('date') || h.includes('time'));
      const idxPeople = headers.findIndex(h => h.includes('people') || h.includes('guests') || h.includes('covers'));
      
      let idxVenue = headers.indexOf('venue');
      if (idxVenue === -1) idxVenue = headers.indexOf('location');
      if (idxVenue === -1) idxVenue = headers.findIndex(h => h.includes('venue') && !h.includes('id'));
      
      const idxAmount = headers.findIndex(h => h === 'amount' || h === 'net_amount' || h === 'total');
      const idxProduct = headers.findIndex(h => h === 'products' || h === 'product');

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
        
        // Skip gift card purchases (not venue bookings)
        if (rowVenue.includes('gift')) continue;
        
        // Get date - use Event date if available, otherwise use date column
        const idxDateAlt = headers.indexOf('date');
        let dateStr = row[idxDate] ? row[idxDate].replace(/"/g, '').trim() : '';
        
        // If Event date is empty but date column exists, use that instead
        if (!dateStr && idxDateAlt !== -1) {
          dateStr = row[idxDateAlt].replace(/"/g, '').trim();
        }

        // Use the same parseDate function as the Lookback tool
        const dateKey = parseDate(dateStr);
        if (!dateKey) continue;

        // Create date object for day-of-week checks
        const dateParts = dateKey.split('-').map(Number);
        const dateVal = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
        if (isNaN(dateVal.getTime())) continue;


        
        const people = parseInt(row[idxPeople]) || 0;
        
        // REVENUE LOGIC
        const productStr = idxProduct > -1 ? (row[idxProduct] || '').toLowerCase() : '';
        
        // Detect ANY ticket-type product (Game Ticket, Game & Drink Ticket, Game & Prosecco Ticket, etc.)
        const isTicketProduct = productStr.includes('ticket') || 
                                productStr.includes('lucky duckers') ||
                                productStr.includes('adults ticket') ||
                                productStr.includes('kids ticket');
        
        const rawAmount = idxAmount > -1 ? parseFloat(row[idxAmount]) || 0 : 0;
        
        let calculatedBookingRevenue = 0;
        if (isTicketProduct) {
           // All ticket products: use £25 per person
           calculatedBookingRevenue = people * FINANCIALS.GAME_TICKET_PRICE;
        } else {
           // Package products (Food & Drinks packages): use actual amount ex VAT
           calculatedBookingRevenue = rawAmount / 1.2;
        }

        const aggKey = `${dateKey}|${rowVenue}`;

        if (!aggregation[aggKey]) {
          aggregation[aggKey] = { 
            dateKey, 
            venue: rowVenue,
            regular: 0, 
            large: 0, 
            regularRevenue: 0,
            largeRevenue: 0
          };
        }

        // Split covers logic AND track revenue separately
        if (people > 10) {
          aggregation[aggKey].large += people;
          aggregation[aggKey].largeRevenue += calculatedBookingRevenue;
        } else {
          aggregation[aggKey].regular += people;
          aggregation[aggKey].regularRevenue += calculatedBookingRevenue;
        }
        
        validRows++;
      }

      const parsed = Object.values(aggregation).map(v => {
        // Apply £25 minimum to large groups
        const minLargeRevenue = v.large * FINANCIALS.GAME_TICKET_PRICE;
        const adjustedLargeRevenue = Math.max(v.largeRevenue, minLargeRevenue);
        
        return {
          dateKey: v.dateKey,
          venue: v.venue,
          regularCovers: v.regular,
          largeGroupCovers: v.large,
          people: v.regular + v.large,
          bookedRevenue: v.regularRevenue + adjustedLargeRevenue
        };
      });

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

  const handleExportPDF = async () => {
    if (!projection) return;
    
    // Dynamically load jsPDF and autotable
    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script1);
    
    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
    document.head.appendChild(script2);
    
    // Wait for scripts to load
    await new Promise(resolve => {
      script2.onload = resolve;
    });
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    const today = new Date().toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(99, 102, 241); // Indigo
    doc.text(`${VENUES[venue].name} - 14-Day Forecast`, 15, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray
    doc.text(`Generated: ${today}`, 15, 22);
    
    // Summary Stats - This Week
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('This Week Summary', 15, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    const thisWeekY = 42;
    doc.text(`Forecast Covers: ${projection.summaries.thisWeek.covers}`, 15, thisWeekY);
    doc.text(`Est. Revenue: £${projection.summaries.thisWeek.revenue.toLocaleString()}`, 80, thisWeekY);
    doc.text(`Budget: £${projection.summaries.thisWeek.budget.toLocaleString()}`, 150, thisWeekY);
    doc.text(`Variance: £${(projection.summaries.thisWeek.budget - projection.summaries.thisWeek.laborCost).toFixed(0)}`, 210, thisWeekY);
    
    // Summary Stats - Next Week
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Next Week Summary', 15, 55);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    const nextWeekY = 62;
    doc.text(`Forecast Covers: ${projection.summaries.nextWeek.covers}`, 15, nextWeekY);
    doc.text(`Est. Revenue: £${projection.summaries.nextWeek.revenue.toLocaleString()}`, 80, nextWeekY);
    doc.text(`Budget: £${projection.summaries.nextWeek.budget.toLocaleString()}`, 150, nextWeekY);
    doc.text(`Variance: £${(projection.summaries.nextWeek.budget - projection.summaries.nextWeek.laborCost).toFixed(0)}`, 210, nextWeekY);
    
    // Table 1: This Week
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('This Week - Daily Breakdown', 15, 75);
    
    const thisWeekData = projection.thisWeek.map(d => [
      d.dateKey,
      d.dayName,
      d.forecastCovers,
      `£${d.revenue.toFixed(0)}`,
      `£${d.budget.toFixed(0)}`,
      `£${d.laborCost.toFixed(0)}`,
      `£${(d.budget - d.laborCost).toFixed(0)}`,
      d.weather ? `${d.weather.temp}°C ${d.weather.condition}` : 'N/A'
    ]);
    
    doc.autoTable({
      startY: 80,
      head: [['Date', 'Day', 'Covers', 'Revenue', 'Budget', 'Labor', 'Variance', 'Weather']],
      body: thisWeekData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' },
        7: { cellWidth: 35 }
      }
    });
    
    // Table 2: Next Week
    const nextWeekStartY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('Next Week - Daily Breakdown', 15, nextWeekStartY);
    
    const nextWeekData = projection.nextWeek.map(d => [
      d.dateKey,
      d.dayName,
      d.forecastCovers,
      `£${d.revenue.toFixed(0)}`,
      `£${d.budget.toFixed(0)}`,
      `£${d.laborCost.toFixed(0)}`,
      `£${(d.budget - d.laborCost).toFixed(0)}`,
      d.weather ? `${d.weather.temp}°C ${d.weather.condition}` : 'N/A'
    ]);
    
    doc.autoTable({
      startY: nextWeekStartY + 5,
      head: [['Date', 'Day', 'Covers', 'Revenue', 'Budget', 'Labor', 'Variance', 'Weather']],
      body: nextWeekData,
      theme: 'grid',
      headStyles: { fillColor: [147, 51, 234], textColor: 255 }, // Purple for next week
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25, halign: 'right' },
        7: { cellWidth: 35 }
      }
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${i} of ${pageCount} | ${VENUES[venue].name} Forecast | Generated ${today}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    // Save
    doc.save(`forecast-${venue}-${new Date().toISOString().split('T')[0]}.pdf`);
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
            {/* ⚠️ GITHUB: Replace GoogleLogin below with the real one from imports */}
            {/* <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} /> */}
            <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} />
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
              <p className="text-xs text-gray-500 mt-1">
                <button 
                  onClick={() => setActiveView('forecast')} 
                  className={`px-3 py-1 rounded-md text-sm mr-2 ${activeView === 'forecast' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Forecast
                </button>
                <button 
                  onClick={() => setActiveView('lookback')} 
                  className={`px-3 py-1 rounded-md text-sm mr-2 ${activeView === 'lookback' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Lookback (Actuals)
                </button>
                <button 
                  onClick={() => setActiveView('food-vendor')} 
                  className={`px-3 py-1 rounded-md text-sm ${activeView === 'food-vendor' ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Food Vendor Report
                </button>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeView === 'forecast' && (
              <select value={venue} onChange={e => setVenue(e.target.value)} className="bg-gray-100 text-sm font-semibold rounded-lg px-4 py-2 hover:bg-gray-200 cursor-pointer">
                {Object.values(VENUES).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {activeView === 'food-vendor' ? (
          <NewcastleFoodVendorReport />
        ) : activeView === 'lookback' ? (
          <LookbackReport />
        ) : (
          /* EXISTING FORECAST UI */
          <>
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
                  <>
                    <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
                      <Download size={16} /> CSV
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium">
                      <FileText size={16} /> PDF Report
                    </button>
                  </>
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
          </>
        )}
      </main>
    </div>
  );
};

// ============================================================================
// GITHUB: UNCOMMENT THIS BLOCK FOR PRODUCTION
// ============================================================================

const ProtectedGlasgowForecast = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Glasgow14DayForecast />
    </GoogleOAuthProvider>
  );
};



export default ProtectedGlasgowForecast;
