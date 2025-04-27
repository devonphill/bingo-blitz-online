
// Define JSON type for the database
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export function parseJson<T>(json: Json | undefined | null): T | null {
  if (!json) return null;
  
  try {
    if (typeof json === 'string') {
      return JSON.parse(json) as T;
    } else {
      return json as T;
    }
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return null;
  }
}

export function prepareForDatabase(data: any): Json {
  return JSON.parse(JSON.stringify(data));
}
