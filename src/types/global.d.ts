
interface Window {
  lastClaimPayload?: any;
  lastClaimResult?: any;
}

interface GameSession {
  id: string;
  name: string;
  status: string;
  lifecycle_state: string;
  access_code: string;
  game_type: string; 
  created_at: string;
  updated_at: string;
  created_by: string;
}
