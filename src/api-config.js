// Booked.it API Configuration - Complete

const BOOKED_IT_BASE_URL = 'https://www.bookedjs.com/api';
const STORAGE_KEY = 'bookedItCredentials';

// ============================================================================
// Authentication Functions
// ============================================================================

export const loginToBookedIt = async (email, password) => {
  try {
    const credentials = btoa(`${email}:${password}`);
    
    const response = await fetch(`${BOOKED_IT_BASE_URL}/bookings`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      throw new Error('Invalid credentials');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    // Store credentials if login successful
    storeCredentials(email, password);

    return await response.json();
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const fetchBookingsFromAPI = async (email, password, startDate, endDate) => {
  try {
    const credentials = btoa(`${email}:${password}`);
    
    const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
    const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;

    const response = await fetch(
      `${BOOKED_IT_BASE_URL}/bookings?start=${start}&end=${end}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

// ============================================================================
// Credential Storage Functions
// ============================================================================

export const storeCredentials = (email, password) => {
  try {
    // Store in sessionStorage (cleared when browser closes)
    const credentialsData = {
      email,
      password,
      timestamp: new Date().getTime()
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentialsData));
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
};

export const getStoredCredentials = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    return null;
  }
};

export const clearStoredCredentials = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

export const hasStoredCredentials = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch (error) {
    console.error('Error checking credentials:', error);
    return false;
  }
};

// ============================================================================
// Data Processing Functions
// ============================================================================

export const parseBookingsForForecast = (bookings) => {
  try {
    if (!Array.isArray(bookings)) {
      return [];
    }

    return bookings.map(booking => ({
      date: booking.date || booking.event_date || new Date().toISOString(),
      people: booking.people || booking.guests || 0,
      status: booking.status || 'active',
      user_id: booking.user_id || null,
      email: booking.email || '',
      username: booking.username || '',
      amount: booking.amount || 0,
      venue: booking.venue || ''
    }));
  } catch (error) {
    console.error('Error parsing bookings:', error);
    return [];
  }
};

export const formatBookingsAsCSV = (bookings) => {
  try {
    if (!bookings || bookings.length === 0) {
      return '';
    }

    const headers = ['date', 'people', 'status', 'user_id', 'email', 'username', 'amount', 'venue'];
    let csv = headers.join(',') + '\n';

    bookings.forEach(booking => {
      const values = headers.map(header => {
        const value = booking[header] || '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });

    return csv;
  } catch (error) {
    console.error('Error formatting bookings as CSV:', error);
    return '';
  }
};

// ============================================================================
// Validation Functions
// ============================================================================

export const validateCredentials = async (email, password) => {
  try {
    const credentials = btoa(`${email}:${password}`);
    
    const response = await fetch(`${BOOKED_IT_BASE_URL}/bookings?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    return response.status === 200;
  } catch (error) {
    console.error('Error validating credentials:', error);
    return false;
  }
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ============================================================================
// Utility Functions
// ============================================================================

export const getAPIStatus = async () => {
  try {
    const response = await fetch(BOOKED_IT_BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Error checking API status:', error);
    return false;
  }
};
