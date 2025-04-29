
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface Client {
  id: string;
  socket: WebSocket;
  type: "caller" | "player";
  sessionId: string;
  playerCode?: string;
  playerName?: string;
  lastActivity: number;
}

// Improved CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const clients: Map<string, Client> = new Map();
const sessions: Map<string, Set<string>> = new Map(); // sessionId -> Set of client ids

// Clean up inactive connections every 30 seconds
setInterval(() => {
  const now = Date.now();
  const timeoutThreshold = 60000; // 1 minute timeout
  
  for (const [id, client] of clients.entries()) {
    if (now - client.lastActivity > timeoutThreshold) {
      console.log(`Removing inactive client: ${id}, type: ${client.type}`);
      removeClient(id);
    }
  }
}, 30000);

function removeClient(clientId: string) {
  const client = clients.get(clientId);
  if (!client) return;
  
  // Remove from session tracking
  if (client.sessionId) {
    const sessionClients = sessions.get(client.sessionId);
    if (sessionClients) {
      sessionClients.delete(clientId);
      
      // If session has no more clients, remove the session
      if (sessionClients.size === 0) {
        sessions.delete(client.sessionId);
      } else {
        // Notify others that this client left
        broadcastToSession(client.sessionId, {
          type: "player_left",
          data: {
            playerCode: client.playerCode,
            playerName: client.playerName,
            timestamp: Date.now(),
          },
        });
      }
    }
  }
  
  try {
    if (client.socket.readyState !== WebSocket.CLOSED) {
      client.socket.close();
    }
  } catch (err) {
    console.error("Error closing socket:", err);
  }
  
  clients.delete(clientId);
}

function broadcastToSession(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) return;
  
  const messageStr = JSON.stringify(message);
  
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
      } catch (err) {
        console.error(`Error sending message to client ${clientId}:`, err);
      }
    }
  }
}

function broadcastToPlayers(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) return;
  
  const messageStr = JSON.stringify(message);
  
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.type === "player" && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
      } catch (err) {
        console.error(`Error sending message to player ${clientId}:`, err);
      }
    }
  }
}

function notifyCaller(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) return;
  
  const messageStr = JSON.stringify(message);
  
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.type === "caller" && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
      } catch (err) {
        console.error(`Error sending message to caller ${clientId}:`, err);
      }
      break; // Only notify one caller (should only be one per session)
    }
  }
}

// Handler for player messages - improved error handling
async function handlePlayerMessage(client: Client, message: any) {
  try {
    if (!message || !message.type) {
      console.error("Invalid message format received from player");
      return;
    }

    switch (message.type) {
      case "join":
        // Add client to session tracking
        let sessionClients = sessions.get(message.sessionId);
        if (!sessionClients) {
          sessionClients = new Set();
          sessions.set(message.sessionId, sessionClients);
        }
        sessionClients.add(client.id);
        
        // Update client info
        client.sessionId = message.sessionId;
        if (message.playerCode) client.playerCode = message.playerCode;
        if (message.playerName) client.playerName = message.playerName;
        
        // Log successful join
        console.log(`Player ${client.playerCode} (${client.playerName}) joined session ${client.sessionId}`);
        
        // Notify caller about new player
        notifyCaller(message.sessionId, {
          type: "player_joined",
          data: {
            playerCode: client.playerCode,
            playerName: client.playerName,
            timestamp: Date.now(),
          },
        });
        
        // Get current game state from database
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const { data, error } = await supabase
            .from('sessions_progress')
            .select('*')
            .eq('session_id', message.sessionId)
            .single();
          
          if (data && !error) {
            const gameState = {
              sessionId: message.sessionId,
              lastCalledNumber: data.called_numbers && data.called_numbers.length > 0 ? 
                data.called_numbers[data.called_numbers.length - 1] : null,
              calledNumbers: data.called_numbers || [],
              currentWinPattern: data.current_win_pattern,
              currentPrize: data.current_prize,
              currentPrizeDescription: data.current_prize_description,
              gameStatus: data.game_status,
              timestamp: Date.now()
            };
            
            // Send current game state to the player
            if (client.socket.readyState === WebSocket.OPEN) {
              client.socket.send(JSON.stringify({
                type: "game_state",
                data: gameState
              }));
            }
          }
        } catch (error) {
          console.error("Error fetching session progress:", error);
          
          // Send error message to client
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify({
              type: "error",
              data: {
                message: "Failed to retrieve game state",
                timestamp: Date.now()
              }
            }));
          }
        }
        break;
        
      case "claim":
        // Forward claim to caller
        notifyCaller(message.sessionId, {
          type: "bingo_claimed",
          data: {
            playerCode: client.playerCode,
            playerName: client.playerName,
            timestamp: Date.now(),
            ...message.data
          },
        });
        break;
        
      case "ping":
        // Update last activity and respond with pong
        client.lastActivity = Date.now();
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({type: "pong", timestamp: Date.now()}));
        }
        break;
        
      default:
        console.log(`Unknown player message type: ${message.type}`);
    }
  } catch (error) {
    console.error(`Error handling player message: ${error}`);
    
    // Send error back to client
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify({
        type: "error",
        data: {
          message: "Server error processing message",
          timestamp: Date.now()
        }
      }));
    }
  }
}

// Handler for caller messages - improved error handling
async function handleCallerMessage(client: Client, message: any) {
  try {
    if (!message || !message.type) {
      console.error("Invalid message format received from caller");
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    switch (message.type) {
      case "number-called":
        // Update database with new called number
        if (message.data?.calledNumbers) {
          try {
            await supabase
              .from('sessions_progress')
              .update({ 
                called_numbers: message.data.calledNumbers,
              })
              .eq('session_id', message.sessionId);
          } catch (error) {
            console.error("Error updating called numbers:", error);
          }
        }
        
        // Broadcast to all players in session
        broadcastToPlayers(message.sessionId, {
          type: "number_called",
          data: {
            lastCalledNumber: message.data?.lastCalledNumber,
            calledNumbers: message.data?.calledNumbers,
            timestamp: Date.now()
          }
        });
        break;
        
      case "pattern-change":
        // Update database with new pattern
        try {
          await supabase
            .from('sessions_progress')
            .update({ 
              current_win_pattern: message.data?.pattern,
              current_prize: message.data?.prize,
              current_prize_description: message.data?.prizeDescription
            })
            .eq('session_id', message.sessionId);
        } catch (error) {
          console.error("Error updating win pattern:", error);
        }
        
        // Broadcast to all players in session
        broadcastToPlayers(message.sessionId, {
          type: "pattern_changed",
          data: {
            currentWinPattern: message.data?.pattern,
            currentPrize: message.data?.prize,
            currentPrizeDescription: message.data?.prizeDescription,
            timestamp: Date.now()
          }
        });
        break;
        
      case "game-start":
        // Update database with game status
        try {
          await supabase
            .from('game_sessions')
            .update({ 
              status: 'active',
              lifecycle_state: 'live'
            })
            .eq('id', message.sessionId);
          
          await supabase
            .from('sessions_progress')
            .update({ game_status: 'active' })
            .eq('session_id', message.sessionId);
        } catch (error) {
          console.error("Error updating game status:", error);
        }
        
        // Broadcast to all players in session
        broadcastToPlayers(message.sessionId, {
          type: "game_started",
          data: {
            gameStatus: 'active',
            timestamp: Date.now()
          }
        });
        break;
        
      case "game-end":
        // Update database with game status
        try {
          await supabase
            .from('game_sessions')
            .update({ status: 'completed' })
            .eq('id', message.sessionId);
          
          await supabase
            .from('sessions_progress')
            .update({ game_status: 'completed' })
            .eq('session_id', message.sessionId);
        } catch (error) {
          console.error("Error updating game status:", error);
        }
        
        // Broadcast to all players in session
        broadcastToPlayers(message.sessionId, {
          type: "game_ended",
          data: {
            gameStatus: 'completed',
            timestamp: Date.now()
          }
        });
        break;
        
      case "next-game":
        // Update database with next game
        const nextGameNumber = message.data?.gameNumber;
        if (nextGameNumber) {
          try {
            await supabase
              .from('game_sessions')
              .update({ current_game: nextGameNumber })
              .eq('id', message.sessionId);
            
            await supabase
              .from('sessions_progress')
              .update({ 
                current_game_number: nextGameNumber,
                called_numbers: [],
                game_status: 'active'
              })
              .eq('session_id', message.sessionId);
          } catch (error) {
            console.error("Error updating game number:", error);
          }
        }
        
        // Broadcast to all players in session
        broadcastToPlayers(message.sessionId, {
          type: "next_game",
          data: {
            gameNumber: nextGameNumber,
            calledNumbers: [],
            lastCalledNumber: null,
            timestamp: Date.now()
          }
        });
        break;
        
      case "claim-result":
        // Broadcast claim result to specific player
        const playerCode = message.data?.playerCode;
        if (playerCode) {
          const sessionClients = sessions.get(message.sessionId);
          if (sessionClients) {
            for (const clientId of sessionClients) {
              const playerClient = clients.get(clientId);
              if (playerClient && 
                  playerClient.type === "player" && 
                  playerClient.playerCode === playerCode &&
                  playerClient.socket.readyState === WebSocket.OPEN) {
                playerClient.socket.send(JSON.stringify({
                  type: "claim_result",
                  data: {
                    result: message.data?.result,
                    timestamp: Date.now()
                  }
                }));
                break;
              }
            }
          }
        }
        break;
        
      case "ping":
        // Update last activity and respond with pong
        client.lastActivity = Date.now();
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({type: "pong", timestamp: Date.now()}));
        }
        break;
        
      default:
        console.log(`Unknown caller message type: ${message.type}`);
    }
  } catch (error) {
    console.error(`Error handling caller message: ${error}`);
    
    // Send error back to client
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify({
        type: "error",
        data: {
          message: "Server error processing message",
          timestamp: Date.now()
        }
      }));
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket connection', { 
      status: 400,
      headers: corsHeaders
    });
  }
  
  const url = new URL(req.url);
  const clientType = url.searchParams.get('type');
  if (clientType !== 'caller' && clientType !== 'player') {
    return new Response('Client type must be caller or player', { 
      status: 400,
      headers: corsHeaders
    });
  }
  
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    return new Response('Session ID is required', { 
      status: 400,
      headers: corsHeaders
    });
  }
  
  const playerCode = url.searchParams.get('playerCode') || undefined;
  const playerName = url.searchParams.get('playerName') || undefined;
  
  console.log(`New WebSocket connection request: ${clientType} for session ${sessionId}`);
  
  // Create WebSocket connection
  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const clientId = crypto.randomUUID();
    
    // Set up client object
    const client: Client = {
      id: clientId,
      socket,
      type: clientType as "caller" | "player",
      sessionId,
      playerCode,
      playerName,
      lastActivity: Date.now()
    };
    
    // Store the client
    clients.set(clientId, client);
    
    // Set up socket event listeners
    socket.onopen = () => {
      console.log(`Client ${clientId} connected as ${clientType} to session ${sessionId}`);
      
      // Add to session tracking
      let sessionClients = sessions.get(sessionId);
      if (!sessionClients) {
        sessionClients = new Set();
        sessions.set(sessionId, sessionClients);
      }
      sessionClients.add(clientId);
      
      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        data: {
          clientId,
          clientType,
          sessionId,
          playerCode,
          timestamp: Date.now()
        }
      }));
    };
    
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        client.lastActivity = Date.now();
        
        if (client.type === "player") {
          await handlePlayerMessage(client, message);
        } else if (client.type === "caller") {
          await handleCallerMessage(client, message);
        }
      } catch (error) {
        console.error(`Error processing message: ${error}`);
        
        // Send error back to client
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error",
            data: {
              message: "Server error processing message",
              timestamp: Date.now()
            }
          }));
        }
      }
    };
    
    socket.onclose = (event) => {
      console.log(`Client ${clientId} disconnected: ${event.code} ${event.reason}`);
      removeClient(clientId);
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      removeClient(clientId);
    };
    
    // Add headers to improve WebSocket stability
    const headers = new Headers(corsHeaders);
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    
    return new Response(response.body, {
      status: response.status,
      headers: headers
    });
    
  } catch (error) {
    console.error("Error upgrading WebSocket connection:", error);
    return new Response(`WebSocket upgrade error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders
    });
  }
});
