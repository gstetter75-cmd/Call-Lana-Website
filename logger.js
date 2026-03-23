// Logger Utility
// Simple console-based logger used by auth.js and db.js
const Logger = {
  error: (context, error) => console.error(`[${context}]`, error),
  warn:  (context, msg)   => console.warn(`[${context}]`, msg),
  log:   (context, msg)   => console.log(`[${context}]`, msg),
};

window.Logger = Logger;
