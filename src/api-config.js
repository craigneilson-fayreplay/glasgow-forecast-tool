// Booked.it API Configuration - Complete Implementation

// ============================================================================
// API CONFIGURATION & CONSTANTS
// ============================================================================

export const API_CONFIG = {
  BASE_URL: 'https://www.bookedjs.com/api/v1',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3
};

export const VENUES = {
  glasgow: { id: 'glasgow', name: 'Glasgow', timezone: 'Europe/London' },
  edinburgh: { id: 'edinburgh', name: 'Edinburgh', timezone: 'Europe/London' },
  newcastle: { id: 'newcastle', name: 'Newcastle', timezone: 'Europe/London' }
};

export const STORAGE_KEYS = {
  TOKEN: 'bookedItToken',
  CREDENTIALS: 'bookedItCredentials',
  TOKEN_EXPIRY: 'bookedItTokenExpiry',
  VENUE: 'selectedVenue'
};

// ============================================================================
// AUTHENTICATION & TOKEN MANAGEMENT
// ============================================================================

/**
 * Login to Booked.it API with email and password
 */
export const loginToBookedIt = async (email, password) => {
  try {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Encode credentials in Base64 for Basic Auth
    const credentials = btoa(`${email}:${password}`);
    
    // Test API connection with a simple request
    const response = await fetch(`${API_CONFIG.BASE_URL}/bookings`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: API_CONFIG.TIMEOUT
    });

    if (response.status === 401) {
      throw new Error('Invalid Booked.it credentials. Please check your email and password.');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Store credentials and token
    storeCredentials(email, password);
    storeToken(credentials, email);

    return {
      success: true,
      email: email,
      token: credentials
    };

  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Get a valid token for API requests
 */
export const getValidToken = async (email, password) => {
  try {
    // Check if we have a stored token that's still valid
    const storedToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    const tokenExpiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

    if (storedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry);
      const currentTime = new Date().getTime();

      // If token expires in more than 1 minute, use it
      if (currentTime < expiryTime - 60000) {
        return storedToken;
      }
    }

    // Token is expired or doesn't exist, create new one
    const credentials = btoa(`${email}:${password}`);
    
    // Verify credentials work
    const response = await fetch(`${API_CONFIG.BASE_URL}/bookings?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid credentials');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    // Store new token
    storeToken(credentials, email);
    return credentials;

  } catch (error) {
    console.error('Error getting valid token:', error);
    throw error;
  }
};

/**
 * Check if current token is still valid
 */
export const isTokenValid = (token) => {
  try {
    if (!token) return false;

    const tokenExpiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (!tokenExpiry) return false;

    const expiryTime = parseInt(tokenExpiry);
    const currentTime = new Date().getTime();

    return currentTime < expiryTime;

  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
};

// ============================================================================
// CREDENTIAL & TOKEN STORAGE
// ============================================================================

const storeCredentials = (email, password) => {
  try {
    const credentialsData = {
      email,
      password,
      timestamp: new Date().getTime()
    };
    sessionStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentialsData));
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
};

const storeToken = (token, email) => {
  try {
    // Store token
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
    
    // Store expiry time (24 hours from now)
    const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000);
    sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    
    // Store email
    sessionStorage.setItem('bookedItEmail', email);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

export const getStoredCredentials = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    return null;
  }
};

export const hasStoredCredentials = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.CREDENTIALS) !== null;
  } catch (error) {
    console.error('Error checking credentials:', error);
    return false;
  }
};

export const clearStoredCredentials = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    sessionStorage.removeItem('bookedItEmail');
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

// ============================================================================
// FETCH BOOKINGS FROM API
// ============================================================================

/**
 * Fetch bookings from Booked.it API for a specific date range
 */
export const fetchBookingsFromAPI = async (venueId, token, startDate, endDate) => {
  try {
    if (!token) {
      throw new Error('No valid token available');
    }

    // Format dates
    const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
    const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;

    const url = new URL(`${API_CONFIG.BASE_URL}/bookings`);
    url.searchParams.append('start', start);
    url.searchParams.append('end', end);
    url.searchParams.append('limit', '1000'); // Fetch all bookings

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.status === 401) {
      throw new Error('Unauthorized: Token has expired');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract bookings array (structure may vary)
    let bookings = Array.isArray(data) ? data : data.bookings || data.data || [];

    return bookings;

  } catch (error) {
    console.error('Error fetching bookings from API:', error);
    throw error;
  }
};

// ============================================================================
// DATA PROCESSING & FORMATTING
// ============================================================================

/**
 * Parse Booked.it API response to forecast format
 */
export const parseBookingsForForecast = (bookings) => {
  try {
    if (!Array.isArray(bookings)) {
      return [];
    }

    return bookings.map(booking => ({
      date: booking.date || booking.event_date || booking.date_time || new Date().toISOString(),
      people: booking.people || booking.guests || booking.number_of_people || 0,
      status: booking.status || 'active',
      user_id: booking.user_id || booking.customer_id || null,
      email: booking.email || booking.customer_email || '',
      username: booking.username || booking.customer_name || booking.name || '',
      amount: booking.amount || booking.price || 0,
      venue: booking.venue || booking.location || ''
    }));

  } catch (error) {
    console.error('Error parsing bookings for forecast:', error);
    return [];
  }
};

/**
 * Format bookings as CSV
 */
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
        // Escape quotes and wrap in quotes if contains comma
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
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate Booked.it credentials
 */
export const validateCredentials = async (email, password) => {
  try {
    if (!email || !password) {
      return false;
    }

    const credentials = btoa(`${email}:${password}`);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/bookings?limit=1`, {
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

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate API connection
 */
export const validateAPIConnection = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: API_CONFIG.TIMEOUT
    });
    return response.ok || response.status === 401; // 401 is expected if not authenticated
  } catch (error) {
    console.error('Error validating API connection:', error);
    return false;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get API status
 */
export const getAPIStatus = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
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

/**
 * Format date for API (YYYY-MM-DD)
 */
export const formatDateForAPI = (date) => {
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

/**
 * Get date range for forecast
 */
export const getDateRange = (days = 14) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  
  return {
    start: formatDateForAPI(today),
    end: formatDateForAPI(endDate),
    startDate: today,
    endDate: endDate
  };
};

/**
 * Retry API call with exponential backoff
 */
export const retryAPICall = async (fn, maxAttempts = API_CONFIG.RETRY_ATTEMPTS) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};
