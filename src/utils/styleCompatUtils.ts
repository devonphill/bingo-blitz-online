import React from 'react';

const compatPolyfills = () => {
  if (!Element.prototype.matches) {
    Element.prototype.matches =
      (Element.prototype as any).msMatchesSelector ||
      Element.prototype.webkitMatchesSelector;
  }

  if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
      let el = this;
      do {
        if (el.matches(s)) return el;
        el = el.parentElement || el.parentNode;
      } while (el !== null && el.nodeType === 1);
      return null;
    };
  }

  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
      return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
  }

  if (!Object.entries) {
    Object.entries = function(obj) {
      let ownProps = Object.keys(obj),
          i = ownProps.length,
          resArray = new Array(i);
      while (i--)
        resArray[i] = [ownProps[i], obj[ownProps[i]]];

      return resArray;
    };
  }

  // Fix for useInsertionEffect
  if (!React.useInsertionEffect) {
    React.useInsertionEffect = React.useLayoutEffect;
  }
};

export const styleCompatUtils = {
  compatPolyfills,
};
