// Unconditionally install working Promise.prototype.finally polyfill for Hermes / React Native
if (typeof Promise !== 'undefined') {
  // eslint-disable-next-line no-extend-native
  Promise.prototype.finally = function (callback) {
    if (typeof callback !== 'function') {
      return this.then(callback, callback);
    }
    const P = (this.constructor as typeof Promise) || Promise;
    return this.then(
      (value) => P.resolve(callback()).then(() => value),
      (reason) =>
        P.resolve(callback()).then(() => {
          throw reason;
        })
    );
  };
}

export {};
