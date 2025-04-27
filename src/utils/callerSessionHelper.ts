
// Fix the recordWinClaim function to match the database table structure
// Modify only the recordWinClaim function to resolve the insert error

export async function recordWinClaim(
  sessionId: string,
  playerId: string,
  playerName: string,
  winPatternId: string,
  ticketInfo: {
    serial: string;
    numbers: number[];
    layoutMask?: number;
    position?: number;
    perm?: number;
  },
  calledNumbers: number[],
  prizeAmount?: string,
  playerEmail?: string
): Promise<any> {
  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('current_game, game_type, name')
      .eq('id', sessionId)
      .single();
      
    if (sessionError) throw sessionError;
    
    const gameNumber = sessionData.current_game;
    const gameType = sessionData.game_type;
    const sessionName = sessionData.name;
    
    // Insert the claim - match column names exactly as defined in the database
    const { data, error } = await supabase
      .from('universal_game_logs')
      .insert({
        session_id: sessionId,
        session_name: sessionName,
        game_type: gameType,
        game_number: gameNumber,
        player_id: playerId,
        player_name: playerName,
        player_email: playerEmail,
        win_pattern: winPatternId,
        ticket_serial: ticketInfo.serial,
        ticket_position: ticketInfo.position || 0,
        ticket_layout_mask: ticketInfo.layoutMask || 0,
        ticket_numbers: ticketInfo.numbers,
        called_numbers: calledNumbers,
        total_calls: calledNumbers.length,
        last_called_number: calledNumbers[calledNumbers.length - 1] || null,
        prize_amount: prizeAmount || '0.00',
        claimed_at: new Date().toISOString(),
        validated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) throw error;
    return data;
    
  } catch (err) {
    console.error('Error recording win claim:', err);
    throw err;
  }
}
