// Production-safe logger — suppresses detailed output unless debug mode is active
const Logger = (() => {
  function isDebug() {
    return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  return {
    error(context, err) {
      if (isDebug()) console.error(`[${context}]`, err);
    },
    warn(context, msg) {
      if (isDebug()) console.warn(`[${context}]`, msg);
    },
    info(context, msg) {
      if (isDebug()) console.info(`[${context}]`, msg);
    }
  };
})();
