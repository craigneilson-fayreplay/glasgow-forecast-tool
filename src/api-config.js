// Booked.it API Configuration

const BOOKED_IT_BASE_URL = 'https://www.bookedjs.com/api';

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
