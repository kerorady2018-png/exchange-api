/**
 * Formats a number with thousand separators and fixed decimal places.
 * Example: 1234567.89 -> 1,234,567.89
 */
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0.00';

  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formats currency values with appropriate precision.
 */
export const formatCurrency = (num, currency = '') => {
  const formatted = formatNumber(num, 2);
  return currency ? `${formatted} ${currency}` : formatted;
};
