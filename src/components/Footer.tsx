
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Footer = () => {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        // Query directly from the version_tracker table to get the current version
        const { data, error } = await supabase
          .from('version_tracker')
          .select('version')
          .single();
          
        if (error) {
          console.error('Error fetching version:', error);
          setVersion('1.0'); // Default fallback version
          return;
        }
        
        if (data) {
          setVersion(data.version.toFixed(1));
        }
      } catch (err) {
        console.error('Failed to fetch version:', err);
        setVersion('1.0'); // Default fallback version
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
    
    // Set up a refresh interval (every 5 minutes)
    const interval = setInterval(fetchVersion, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="py-2 px-4 bg-gray-100 text-gray-600 text-xs text-center fixed bottom-0 w-full">
      {loading ? 'Loading version...' : `Version ${version}`}
    </footer>
  );
};
