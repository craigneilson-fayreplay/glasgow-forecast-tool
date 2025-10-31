// ============================================================================
// BOOKED.IT API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  BASE_URL: 'https://api.booked.it',
  ENDPOINTS: {
    LOGIN: '/api/v1/user/login',
    BOOKINGS: '/api/v1/bookings',
    VENUES: '/api/v1/venues'
  }
};

export const VENUES = {
  newcastle: { id: 225, name: 'Fayre Play Newcastle' },
  glasgow: { id: 226, name: 'Fayre Play Glasgow' },
  edinburgh: { id: 227, name: 'Fayre Play Edinburgh' }
};

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  API_TOKEN: 'booked_it_api_token',
  TOKEN_EXPIRY: 'booked_it_token_expiry',
  LAST_FETCH: 'forecast_last_fetch'
};

// ============================================================================
// API HELPER FUNCTIONS
// ============================================================================

/**
 * Login to Booked.it API and return bearer token
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{token: string, expiresIn: number}>}
 */
export const loginToBookedIt = async (email, password) => {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Store token and expiry
    const expiryTime = Date.now() + (data.expiresIn * 1000);
    localStorage.setItem(STORAGE_KEYS.API_TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    
    return {
      token: data.token,
      expiresIn: data.expiresIn
    };
  } catch (error) {
    throw new Error(`Failed to login: ${error.message}`);
  }
};

/**
 * Check if stored token is still valid
 * @returns {boolean}
 */
export const isTokenValid = () => {
  const token = localStorage.getItem(STORAGE_KEYS.API_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  
  if (!token || !expiry) return false;
  
  return Date.now() < parseInt(expiry);
};

/**
 * Get valid API token, refreshing if needed
 * @param {string} email - User email (needed for refresh)
 * @param {string} password - User password (needed for refresh)
 * @returns {Promise<string>}
 */
export const getValidToken = async (email, password) => {
  if (isTokenValid()) {
    return localStorage.getItem(STORAGE_KEYS.API_TOKEN);
  }
  
  // Token expired, login again
  const result = await loginToBookedIt(email, password);
  return result.token;
};

/**
 * Fetch bookings from Booked.it API for a venue
 * @param {number} venueId - Provider ID (225, 226, or 227)
 * @param {string} token - API bearer token
 * @param {Date} startDate - Start date for booking filter
 * @param {Date} endDate - End date for booking filter
 * @returns {Promise<Array>}
 */
export const fetchBookingsFromAPI = async (venueId, token, startDate, endDate) => {
  try {
    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const start = formatDate(startDate);
    const end = formatDate(endDate);

    const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOKINGS}`);
    url.searchParams.append('provider_id', venueId);
    url.searchParams.append('start_date', start);
    url.searchParams.append('end_date', end);
    url.searchParams.append('status', 'active'); // Only active bookings

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - token may have expired');
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Update last fetch timestamp
    localStorage.setItem(STORAGE_KEYS.LAST_FETCH, new Date().toISOString());
    
    return data.bookings || [];
  } catch (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }
};

/**
 * Clear stored credentials (logout)
 */
export const clearStoredCredentials = () => {
  localStorage.removeItem(STORAGE_KEYS.API_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.LAST_FETCH);
};
