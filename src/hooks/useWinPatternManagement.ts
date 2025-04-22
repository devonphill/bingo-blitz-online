
// WIN PATTERN MANAGEMENT FOR GLOBAL TABLE (no session/user/prizes), SIMPLE 1-5 ACTIVE FLAGS

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Winline {
  id: number; // 1-5
  name: string;
  active: boolean;
}

export function useWinPatternManagement() {
  // Global winlines for config (up to 5 possible, always 1 row)
  const [winlines, setWinlines] = useState<Winline[]>([
    { id: 1, name: 'Winline 1', active: true },
    { id: 2, name: 'Winline 2', active: true },
    { id: 3, name: 'Winline 3', active: true },
    { id: 4, name: 'Winline 4', active: false },
    { id: 5, name: 'Winline 5', active: false },
  ]);
  const [currentActiveWinline, setCurrentActiveWinline] = useState<number>(1);
  const { toast } = useToast();

  // Fetch global winlines config (just the ID=1 row)
  const fetchWinlinesConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from('win_patterns')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      console.error('Error fetching win_patterns:', error);
      return;
    }
    if (data) {
      setWinlines([
        { id: 1, name: 'Winline 1', active: !!data.winline_1_active },
        { id: 2, name: 'Winline 2', active: !!data.winline_2_active },
        { id: 3, name: 'Winline 3', active: !!data.winline_3_active },
        { id: 4, name: 'Winline 4', active: !!data.winline_4_active },
        { id: 5, name: 'Winline 5', active: !!data.winline_5_active },
      ]);
    }
  }, []);

  // Update win_patterns global config for toggling winlines
  const updateWinlineActive = useCallback(async (winlineId: number, newActive: boolean) => {
    const key = `winline_${winlineId}_active`;
    const updateObj: Record<string, boolean> = {};
    updateObj[key] = newActive;
    await supabase
      .from('win_patterns')
      .update(updateObj)
      .eq('id', 1);
    // Refresh
    fetchWinlinesConfig();
  }, [fetchWinlinesConfig]);

  const handleToggleWinline = useCallback((winlineId: number) => {
    const cur = winlines.find(wl => wl.id === winlineId);
    if (cur) {
      updateWinlineActive(winlineId, !cur.active);
    }
  }, [winlines, updateWinlineActive]);

  useEffect(() => { fetchWinlinesConfig(); }, [fetchWinlinesConfig]);

  return {
    winlines, // Array of { id: 1-5, name, active }
    currentActiveWinline,
    handleToggleWinline,
  };
}
