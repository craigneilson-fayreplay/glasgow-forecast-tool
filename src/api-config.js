// Booked.it API Configuration - CORRECTED VERSION

const BOOKED_IT_BASE_URL = 'https://www.bookedjs.com/api';

/**
 * Authenticate with Booked.it using email and password
 * Returns booking data if successful
 */
export const authenticateBooked = async (email, password) => {
  try {
    // Encode credentials in Base64 for Basic Auth
    const credentials = btoa(`${email}:${password}`);
    
    const response = await fetch(`${BOOKED_IT_BASE_URL}/bookings`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.status === 401) {
      throw new Error('Invalid credentials. Please check your email and password.');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

/**
 * Fetch bookings for a specific date range
 */
export const fetchBookingsByDateRange = async (email, password, startDate, endDate) => {
  try {
    const credentials = btoa(`${email}:${password}`);
    
    // Format dates as YYYY-MM-DD if they're Date objects
    const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
    const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;

    const response = await fetch(
      `${BOOKED_IT_BASE_URL}/bookings?start=${start}&end=${end}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error fetching bookings by date range:', error);
    throw error;
  }
};

/**
 * Export bookings as CSV format (for compatibility)
 */
export const exportBookingsAsCSV = (bookings) => {
  try {
    if (!bookings || bookings.length === 0) {
      return '';
    }

    // Extract headers from first booking
    const headers = Object.keys(bookings[0]);
    
    // Create CSV content
    let csv = headers.join(',') + '\n';
    bookings.forEach(booking => {
      const values = headers.map(header => {
        const value = booking[header];
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
    console.error('Error exporting bookings as CSV:', error);
    throw error;
  }
};

/**
 * Validate Booked.it credentials
 */
export const validateCredentials = async (email, password) => {
  try {
    const credentials = btoa(`${email}:${password}`);
    
    const response = await fetch(`${BOOKED_IT_BASE_URL}/bookings?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return response.status === 200;

  } catch (error) {
    console.error('Error validating credentials:', error);
    return false;
  }
};

/**
 * Parse Booked.it booking data to forecast format
 */
export const parseBookingsForForecast = (bookings) => {
  try {
    if (!Array.isArray(bookings)) {
      console.warn('Bookings is not an array:', bookings);
      return [];
    }

    return bookings.map(booking => ({
      date: booking.date || booking.event_date || booking.booking_date,
      people: booking.people || booking.guests || booking.party_size || 0,
      status: booking.status || 'active',
      user_id: booking.user_id || booking.customer_id || null,
      email: booking.email || booking.customer_email || '',
      username: booking.username || booking.customer_name || '',
      amount: booking.amount || booking.price || 0,
      venue: booking.venue || booking.location || '',
      name: booking.name || booking.customer_name || ''
    }));

  } catch (error) {
    console.error('Error parsing bookings for forecast:', error);
    return [];
  }
};
