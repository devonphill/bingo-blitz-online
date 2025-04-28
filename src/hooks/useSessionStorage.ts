
import { useState, useEffect } from 'react';

export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Get stored value from session storage or return initial value
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  };

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists the new value to sessionStorage
  const setValue = (value: T) => {
    if (typeof window === 'undefined') {
      console.warn(
        `Tried setting sessionStorage key "${key}" even though environment is not a browser`
      );
      return;
    }

    try {
      // Save state
      setStoredValue(value);
      // Save to session storage
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  // Listen for changes to this sessionStorage outside of this hook
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.sessionStorage) {
        setStoredValue(event.newValue ? JSON.parse(event.newValue) : initialValue);
      }
    };
    
    // Listen for storage change events
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
