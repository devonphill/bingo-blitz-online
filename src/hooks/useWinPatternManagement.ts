
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Winline {
  id: number; // 1-5
  name: string;
  active: boolean;
}

export interface ActiveWinlines {
  id: string;
  session_id: string;
  user_id: string;
  winline_1_prize: string | null;
  winline_2_prize: string | null;
  winline_3_prize: string | null;
  winline_4_prize: string | null;
  winline_5_prize: string | null;
  active_winline: number; // 1-5
  created_at: string;
  updated_at: string;
}

export function useWinPatternManagement(sessionId: string | undefined, userId: string | undefined) {
  // Winlines for config (up to 5 possible)
  const [winlines, setWinlines] = useState<Winline[]>([
    { id: 1, name: 'Winline 1', active: true },
    { id: 2, name: 'Winline 2', active: false },
    { id: 3, name: 'Winline 3', active: false },
    { id: 4, name: 'Winline 4', active: false },
    { id: 5, name: 'Winline 5', active: false },
  ]);
  // Active winlines/prizes state
  const [activeWinlines, setActiveWinlines] = useState<ActiveWinlines | null>(null);
  // For convenience
  const [currentActiveWinline, setCurrentActiveWinline] = useState<number>(1);
  const { toast } = useToast();

  // Fetch session winline config (flags for which winlines are active)
  const fetchWinlinesConfig = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase
      .from('win_patterns')
      .select('*')
      .eq('session_id', sessionId)
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
  }, [sessionId]);

  // Update win_patterns config for toggling winlines
  const updateWinlineActive = useCallback(async (winlineId: number, newActive: boolean) => {
    if (!sessionId) return;
    const key = `winline_${winlineId}_active`;
    const updateObj: Record<string, boolean> = {};
    updateObj[key] = newActive;
    await supabase
      .from('win_patterns')
      .update(updateObj)
      .eq('session_id', sessionId);
    // Refresh
    fetchWinlinesConfig();
  }, [sessionId, fetchWinlinesConfig]);

  // Fetch prizes & active winline for the session/user
  const fetchActiveWinlines = useCallback(async () => {
    if (!sessionId || !userId) return;
    const { data, error } = await supabase
      .from('active_winlines')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching active_winlines:', error);
      return;
    }
    if (data) {
      setActiveWinlines(data);
      setCurrentActiveWinline(data.active_winline || 1);
    }
  }, [sessionId, userId]);

  // Called to advance to next valid winline
  const progressWinline = useCallback(async () => {
    if (!activeWinlines) return null;
    // Get sorted actives
    const activeIds = winlines.filter(wl => wl.active).map(wl => wl.id).sort((a, b) => a - b);
    const currentIdx = activeIds.indexOf(activeWinlines.active_winline);
    if (currentIdx === -1) return null; // impossible
    // Progress to next active, if any
    const next = activeIds[currentIdx + 1];
    if (next) {
      // Update DB and state
      const { error } = await supabase
        .from('active_winlines')
        .update({ active_winline: next })
        .eq('id', activeWinlines.id);
      if (!error) {
        setCurrentActiveWinline(next);
        setActiveWinlines(prev => (prev ? { ...prev, active_winline: next } : prev));
        toast({
          title: 'Advanced to Next Winline',
          description: `Now requiring winline #${next}`,
        });
      }
      return next;
    }
    // No more; all finished
    return null;
  }, [activeWinlines, winlines, toast]);

  // Toggle winline active status in config
  const handleToggleWinline = useCallback((winlineId: number) => {
    const cur = winlines.find(wl => wl.id === winlineId);
    if (cur) {
      updateWinlineActive(winlineId, !cur.active);
    }
  }, [winlines, updateWinlineActive]);

  // Change prize for a winline
  const handlePrizeChange = useCallback(async (winlineId: number, prize: string) => {
    if (!activeWinlines) return;
    const prizeKey = `winline_${winlineId}_prize`;
    const updateObj: Record<string, string> = {};
    updateObj[prizeKey] = prize;
    const { error } = await supabase
      .from('active_winlines')
      .update(updateObj)
      .eq('id', activeWinlines.id);
    if (!error) {
      setActiveWinlines(prev => prev ? { ...prev, [prizeKey]: prize } : prev);
      toast({ title: 'Prize updated', description: `Prize set for winline #${winlineId}` });
    }
  }, [activeWinlines, toast]);

  // Set up and fetch config/prizes on load
  useEffect(() => { fetchWinlinesConfig(); }, [fetchWinlinesConfig]);
  useEffect(() => { fetchActiveWinlines(); }, [fetchActiveWinlines]);
  // Refetch when toggling etc
  useEffect(() => { fetchActiveWinlines(); }, [activeWinlines?.active_winline]); 

  return {
    winlines, // Array of { id: 1-5, name, active }
    currentActiveWinline, // index (1-based)
    activeWinlines,
    handleToggleWinline,
    handlePrizeChange,
    progressWinline
  };
}
