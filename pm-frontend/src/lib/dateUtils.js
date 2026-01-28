// Philippine Standard Time is UTC+8
const PHILIPPINE_OFFSET_HOURS = 8;

/**
 * Convert UTC date string to Philippine Time
 * @param {string} utcDateString - Date string in UTC (e.g., "2024-01-15" or "2024-01-15T10:30:00")
 * @returns {Date} Date object in Philippine Time
 */
export function utcToPhilippineTime(utcDateString) {
  if (!utcDateString) return null;

  // If it's just a date (YYYY-MM-DD), treat it as midnight UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(utcDateString)) {
    const date = new Date(utcDateString + "T00:00:00Z");
    return new Date(date.getTime() + PHILIPPINE_OFFSET_HOURS * 60 * 60 * 1000);
  }

  // For datetime strings
  const date = new Date(utcDateString);
  return new Date(date.getTime() + PHILIPPINE_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Convert Philippine Time to UTC date string (YYYY-MM-DD format)
 * @param {Date} philippineDate - Date object in Philippine Time
 * @returns {string} Date string in UTC (YYYY-MM-DD)
 */
export function philippineTimeToUtcString(philippineDate) {
  if (!philippineDate) return "";

  // Subtract 8 hours to convert from Philippine Time to UTC
  const utcDate = new Date(
    philippineDate.getTime() - PHILIPPINE_OFFSET_HOURS * 60 * 60 * 1000,
  );

  const year = utcDate.getFullYear();
  const month = String(utcDate.getMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Get current date in Philippine Time (YYYY-MM-DD format)
 * @returns {string} Current date in Philippine Time
 */
export function getCurrentPhilippineDate() {
  const now = new Date();
  const philippineTime = new Date(
    now.getTime() + PHILIPPINE_OFFSET_HOURS * 60 * 60 * 1000,
  );

  const year = philippineTime.getFullYear();
  const month = String(philippineTime.getMonth() + 1).padStart(2, "0");
  const day = String(philippineTime.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Format UTC date string to Philippine Time locale string
 * @param {string} utcDateString - Date string in UTC
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in Philippine Time
 */
export function formatPhilippineDate(utcDateString, options = {}) {
  if (!utcDateString) return "";

  const philippineDate = utcToPhilippineTime(utcDateString);

  const defaultOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...options,
  };

  return philippineDate.toLocaleDateString("en-PH", defaultOptions);
}

/**
 * Format UTC datetime string to Philippine Time locale string (with time)
 * @param {string} utcDateString - Datetime string in UTC
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted datetime string in Philippine Time
 */
export function formatPhilippineDateTime(utcDateString, options = {}) {
  if (!utcDateString) return "";

  const philippineDate = utcToPhilippineTime(utcDateString);

  const defaultOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
    ...options,
  };

  return philippineDate.toLocaleString("en-PH", defaultOptions);
}

/**
 * Parse a date string that's already in Philippine Time format
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {Date} Date object
 */
export function parsePhilippineDate(dateString) {
  if (!dateString) return null;

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}
