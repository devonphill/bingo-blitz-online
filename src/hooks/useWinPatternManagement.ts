
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useWinPatternManagement(sessionId: string | undefined) {
  const [winPatterns, setWinPatterns] = useState<string[]>(["oneLine", "twoLines", "fullHouse"]);
  const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({
    oneLine: "",
    twoLines: "",
    fullHouse: "",
  });
  const [currentGameWinPattern, setCurrentGameWinPattern] = useState<string | null>("oneLine");
  const { toast } = useToast();

  const progressWinPattern = () => {
    if (!currentGameWinPattern) return null;
    const patterns = ["oneLine", "twoLines", "fullHouse"];
    const currentIndex = patterns.indexOf(currentGameWinPattern);
    const nextPattern = patterns[currentIndex + 1];
    
    if (nextPattern && winPatterns.includes(nextPattern)) {
      setCurrentGameWinPattern(nextPattern);
      return nextPattern;
    }
    return null;
  };

  useEffect(() => {
    const fetchWinPatterns = async () => {
      if (!sessionId) return;
      
      const { data, error } = await supabase
        .from('win_patterns')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) {
        console.error("Error fetching win patterns:", error);
        return;
      }

      if (data) {
        const activePatterns: string[] = [];
        const prizes: { [key: string]: string } = {};

        if (data.one_line_active) {
          activePatterns.push("oneLine");
          prizes.oneLine = data.one_line_prize || "";
        }
        if (data.two_lines_active) {
          activePatterns.push("twoLines");
          prizes.two_lines_prize = data.two_lines_prize || "";
        }
        if (data.full_house_active) {
          activePatterns.push("fullHouse");
          prizes.full_house_prize = data.full_house_prize || "";
        }

        setWinPatterns(activePatterns);
        setWinPrizes(prizes);
      }
    };

    fetchWinPatterns();
  }, [sessionId]);

  return {
    winPatterns,
    winPrizes,
    currentGameWinPattern,
    setCurrentGameWinPattern,
    progressWinPattern
  };
}
