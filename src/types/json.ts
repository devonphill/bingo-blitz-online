
// Define a recursive JSON type for better type handling with Supabase
export type Json = 
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// Type guard to check if an object is of a specific interface type
export function isOfType<T>(obj: any, props: Array<keyof T>): obj is T {
  return props.every(prop => prop in obj);
}

// Helper function for safely type-asserting JSON objects from API responses
export function typedJsonValue<T>(json: any): T {
  return json as T;
}
