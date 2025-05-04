import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Enhanced CORS headers with more allowed origins and protocols
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

interface Client {
  id: string;
  socket: WebSocket;
  type: "caller" | "player";
  sessionId: string;
  playerCode?: string;
  playerName?: string;
  instanceId?: string;
  lastActivity: number;
  pingTimer?: number;
}

// Initialize Supabase client for realtime fallback
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") || "https://weqosgnuiixccghdoccw.supabase.co",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { auth: { persistSession: false } }
);

// Store connected clients
const clients: Map<string, Client> = new Map();
// Track clients by session
const sessions: Map<string, Set<string>> = new Map(); // sessionId -> Set of client ids

// Debug logging with timestamps
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - ${message}`);
};

// Initial startup log
logWithTimestamp("Bingo Hub function initialized with improved connection handling");

// Set up realtime broadcast channel for fallback
const setupRealtimeFallback = () => {
  try {
    const channel = supabaseClient.channel('number-broadcast');
    
    // Listen for bingo claims
    channel
      .on('broadcast', { event: 'bingo-claim' }, (payload) => {
        logWithTimestamp(`Received bingo claim via realtime fallback: ${JSON.stringify(payload.payload)}`);
        const { sessionId, playerCode, playerName, ticketData, timestamp, instanceId } = payload.payload;
        
        // Find caller clients for this session
        const sessionClients = sessions.get(sessionId);
        if (sessionClients) {
          // Notify callers about the claim
          for (const clientId of sessionClients) {
            const client = clients.get(clientId);
            if (client && client.type === "caller" && client.socket.readyState === WebSocket.OPEN) {
              try {
                client.socket.send(JSON.stringify({
                  type: "bingo_claimed",
                  data: {
                    playerCode,
                    playerName,
                    ticketData,
                    timestamp,
                    instanceId
                  }
                }));
                logWithTimestamp(`Notified caller ${clientId} about claim from ${playerCode}`);
              } catch (err) {
                console.error(`Error sending message to caller ${clientId}:`, err);
              }
            }
          }
        }
      })
      .subscribe();
      
    logWithTimestamp("Realtime fallback system initialized");
    
  } catch (error) {
    console.error("Error setting up realtime fallback:", error);
  }
};

// Set up the fallback system
setupRealtimeFallback();

// Clean up inactive connections every 30 seconds
setInterval(() => {
  try {
    const now = Date.now();
    const timeoutThreshold = 300000; // 5 minutes timeout
    
    logWithTimestamp(`Checking for inactive clients. Total clients: ${clients.size}`);
    
    for (const [id, client] of clients.entries()) {
      if (now - client.lastActivity > timeoutThreshold) {
        logWithTimestamp(`Removing inactive client: ${id}, type: ${client.type}, session: ${client.sessionId}`);
        try {
          removeClient(id);
        } catch (err) {
          console.error(`Error removing inactive client ${id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Error in cleanup interval:", err);
  }
}, 30000);

// Send ping to all clients every 25 seconds to keep connections alive
setInterval(() => {
  try {
    for (const [id, client] of clients.entries()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify({
            type: "ping",
            data: {
              timestamp: Date.now()
            }
          }));
        } catch (err) {
          console.error(`Error sending ping to client ${id}:`, err);
          // If we can't send a ping, consider the client dead and remove it
          removeClient(id);
        }
      } else if (client.socket.readyState === WebSocket.CLOSED || client.socket.readyState === WebSocket.CLOSING) {
        // Remove clients with closed websockets
        removeClient(id);
      }
    }
  } catch (err) {
    console.error("Error in ping interval:", err);
  }
}, 25000);

function removeClient(clientId: string) {
  const client = clients.get(clientId);
  if (!client) {
    logWithTimestamp(`Client ${clientId} not found for removal`);
    return;
  }
  
  // Clear ping timer if it exists
  if (client.pingTimer) {
    clearTimeout(client.pingTimer);
  }
  
  // Remove from session tracking
  if (client.sessionId) {
    const sessionClients = sessions.get(client.sessionId);
    if (sessionClients) {
      sessionClients.delete(clientId);
      logWithTimestamp(`Removed client ${clientId} from session ${client.sessionId}. Remaining clients in session: ${sessionClients.size}`);
      
      // If session has no more clients, remove the session
      if (sessionClients.size === 0) {
        logWithTimestamp(`Session ${client.sessionId} has no more clients. Removing session.`);
        sessions.delete(client.sessionId);
      } else {
        // Notify others that this client left
        try {
          broadcastToSession(client.sessionId, {
            type: "player_left",
            data: {
              playerCode: client.playerCode,
              playerName: client.playerName,
              timestamp: Date.now(),
            },
          });
        } catch (err) {
          console.error(`Error broadcasting player left for client ${clientId}:`, err);
        }
      }
    }
  }
  
  try {
    if (client.socket.readyState !== WebSocket.CLOSED && client.socket.readyState !== WebSocket.CLOSING) {
      logWithTimestamp(`Closing socket for client ${clientId}`);
      client.socket.close(1000, "Normal close");
    }
  } catch (err) {
    console.error(`Error closing socket for client ${clientId}:`, err);
  }
  
  clients.delete(clientId);
  logWithTimestamp(`Client ${clientId} removed from clients map. New total: ${clients.size}`);
}

function broadcastToSession(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients || sessionClients.size === 0) {
    logWithTimestamp(`No clients found for session ${sessionId} to broadcast to`);
    return;
  }
  
  const messageStr = JSON.stringify(message);
  logWithTimestamp(`Broadcasting to session ${sessionId} (${sessionClients.size} clients): ${message.type}`);
  
  let sentCount = 0;
  let errorCount = 0;
  
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (!client) {
      logWithTimestamp(`Client ${clientId} not found in clients map`);
      continue;
    }
    
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
        sentCount++;
      } catch (err) {
        console.error(`Error sending message to client ${clientId}:`, err);
        errorCount++;
      }
    } else {
      logWithTimestamp(`Client ${clientId} socket not open (state: ${client.socket.readyState})`);
    }
  }
  
  // Also broadcast via Supabase realtime as fallback
  try {
    const channel = supabaseClient.channel('number-broadcast');
    channel.send({
      type: 'broadcast',
      event: 'number-called',
      payload: {
        ...message.data,
        sessionId,
        timestamp: Date.now()
      }
    }).then(() => {
      logWithTimestamp(`Also sent message via realtime broadcast: ${message.type}`);
    }, (err) => {
      console.error("Error broadcasting via realtime:", err);
    });
  } catch (err) {
    console.error("Error broadcasting via realtime:", err);
  }
  
  logWithTimestamp(`Message sent to ${sentCount} clients, errors: ${errorCount}, total clients: ${sessionClients.size}`);
}

function broadcastToPlayers(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) {
    logWithTimestamp(`No clients found for session ${sessionId}`);
    return;
  }
  
  const messageStr = JSON.stringify(message);
  
  let sentCount = 0;
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.type === "player" && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
        sentCount++;
      } catch (err) {
        console.error(`Error sending message to player ${clientId}:`, err);
      }
    }
  }
  
  // Also broadcast via Supabase realtime as fallback
  try {
    const channel = supabaseClient.channel('number-broadcast');
    channel.send({
      type: 'broadcast',
      event: 'number-called',
      payload: {
        ...message.data,
        activeWinPattern: message.data?.currentWinPattern,
        prizeInfo: {
          currentPrize: message.data?.currentPrize,
          currentPrizeDescription: message.data?.currentPrizeDescription
        },
        sessionId,
        timestamp: Date.now()
      }
    });
    
    logWithTimestamp(`Also sent message to players via realtime broadcast: ${message.type}`);
  } catch (err) {
    console.error("Error broadcasting to players via realtime:", err);
  }
  
  logWithTimestamp(`Player broadcast sent to ${sentCount} players`);
}

function notifyCaller(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) {
    logWithTimestamp(`No clients found for session ${sessionId}`);
    return;
  }
  
  const messageStr = JSON.stringify(message);
  
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.type === "caller" && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
        logWithTimestamp(`Notified caller ${clientId} in session ${sessionId}: ${message.type}`);
        break; // Only notify one caller (should only be one per session)
      } catch (err) {
        console.error(`Error sending message to caller ${clientId}:`, err);
      }
    }
  }
}

// Handler for player messages
async function handlePlayerMessage(client: Client, message: any) {
  try {
    if (!message || !message.type) {
      console.error("Invalid message format received from player");
      return;
    }

    client.lastActivity = Date.now(); // Update last activity
    logWithTimestamp(`Processing player message of type: ${message.type}`);

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
        if (message.instanceId) client.instanceId = message.instanceId;
        
        // Log successful join
        logWithTimestamp(`Player ${client.playerCode} (${client.playerName}) joined session ${client.sessionId}`);
        
        // Notify caller about new player
        notifyCaller(message.sessionId, {
          type: "player_joined",
          data: {
            playerCode: client.playerCode,
            playerName: client.playerName,
            timestamp: Date.now(),
          },
        });
        
        // Also send acknowledgment to the player
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({
            type: "join_acknowledged",
            data: {
              playerCode: client.playerCode, 
              timestamp: Date.now()
            }
          }));
        }
        
        break;
        
      case "claim":
        // Forward claim to caller
        logWithTimestamp(`Player ${client.playerCode} claiming bingo in session ${message.sessionId}`);
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
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({type: "pong", timestamp: Date.now()}));
        }
        break;
        
      default:
        logWithTimestamp(`Unknown player message type: ${message.type}`);
    }
  } catch (error) {
    console.error(`Error handling player message: ${error}`);
    
    // Send error back to client
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify({
          type: "error",
          data: {
            message: "Server error processing message",
            timestamp: Date.now()
          }
        }));
      } catch (err) {
        console.error("Error sending error message back to client:", err);
      }
    }
  }
}

// Handler for caller messages
async function handleCallerMessage(client: Client, message: any) {
  try {
    if (!message || !message.type) {
      console.error("Invalid message format received from caller");
      return;
    }

    client.lastActivity = Date.now(); // Update last activity
    logWithTimestamp(`Processing caller message of type: ${message.type}`);
    
    switch (message.type) {
      case "number-called":
        // Broadcast to all players in session
        logWithTimestamp(`Caller called number: ${message.data?.lastCalledNumber}, session: ${message.sessionId}`);
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
        // Broadcast to all players in session
        logWithTimestamp(`Caller changed pattern to: ${message.data?.pattern}, session: ${message.sessionId}`);
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
        // Broadcast to all players in session
        logWithTimestamp(`Caller started game in session: ${message.sessionId}`);
        broadcastToPlayers(message.sessionId, {
          type: "game_started",
          data: {
            gameStatus: 'active',
            timestamp: Date.now()
          }
        });
        break;
        
      case "game-end":
        // Broadcast to all players in session
        logWithTimestamp(`Caller ended game in session: ${message.sessionId}`);
        broadcastToPlayers(message.sessionId, {
          type: "game_ended",
          data: {
            gameStatus: 'completed',
            timestamp: Date.now()
          }
        });
        break;
        
      case "next-game":
        // Broadcast to all players in session
        logWithTimestamp(`Caller advanced to next game (${message.data?.gameNumber}) in session: ${message.sessionId}`);
        broadcastToPlayers(message.sessionId, {
          type: "next_game",
          data: {
            gameNumber: message.data?.gameNumber,
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
          logWithTimestamp(`Claim result for player ${playerCode}: ${message.data?.result}`);
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
                logWithTimestamp(`Sent claim result to player ${playerCode}`);
                break;
              }
            }
            
            // Also broadcast via Supabase realtime as fallback
            try {
              const channel = supabaseClient.channel(`player-claims-${message.data?.instanceId || 'unknown'}`);
              channel.send({
                type: 'broadcast',
                event: 'claim-result',
                payload: {
                  playerId: playerCode,
                  result: message.data?.result,
                  timestamp: Date.now()
                }
              });
              
              logWithTimestamp(`Also sent claim result via realtime broadcast for player ${playerCode}`);
            } catch (err) {
              console.error(`Error broadcasting claim result via realtime:`, err);
            }
          }
        }
        break;
        
      case "ping":
        // Update last activity and respond with pong
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({type: "pong", timestamp: Date.now()}));
        }
        break;
        
      default:
        logWithTimestamp(`Unknown caller message type: ${message.type}`);
    }
  } catch (error) {
    console.error(`Error handling caller message: ${error}`);
    
    // Send error back to client
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify({
          type: "error",
          data: {
            message: "Server error processing message",
            timestamp: Date.now()
          }
        }));
      } catch (err) {
        console.error("Error sending error message back to client:", err);
      }
    }
  }
}

// Main handler for HTTP requests
serve(async (req) => {
  logWithTimestamp(`Received request to bingo-hub endpoint: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logWithTimestamp("Handling OPTIONS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const upgradeHeader = req.headers.get('upgrade') || '';
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      logWithTimestamp("Non-WebSocket request rejected");
      return new Response('Expected WebSocket connection', { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    const url = new URL(req.url);
    logWithTimestamp(`Received WebSocket connection request URL: ${req.url}`);
    
    const clientType = url.searchParams.get('type');
    if (clientType !== 'caller' && clientType !== 'player') {
      logWithTimestamp(`Invalid client type: ${clientType}`);
      return new Response('Invalid client type. Must be "caller" or "player"', { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Extract parameters
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      logWithTimestamp('Missing sessionId parameter');
      return new Response('Missing sessionId parameter', { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    const playerCode = url.searchParams.get('playerCode');
    const playerName = url.searchParams.get('playerName');
    const instanceId = url.searchParams.get('instanceId');
    
    logWithTimestamp(`New WebSocket connection request: ${clientType} for session ${sessionId}, playerCode: ${playerCode || 'undefined'}`);
    
    // Create WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    const clientId = crypto.randomUUID();
    
    // Store client info
    const client: Client = {
      id: clientId,
      socket,
      type: clientType as 'caller' | 'player',
      sessionId,
      playerCode,
      playerName,
      instanceId,
      lastActivity: Date.now()
    };
    
    clients.set(clientId, client);
    logWithTimestamp(`WebSocket upgrade successful for clientId: ${clientId}`);
    
    // Set up event handlers
    socket.onopen = () => {
      logWithTimestamp(`WebSocket connection established for client ${clientId}`);
      
      // Add to session tracking
      let sessionClients = sessions.get(sessionId);
      if (!sessionClients) {
        sessionClients = new Set();
        sessions.set(sessionId, sessionClients);
      }
      sessionClients.add(clientId);
      
      // Send immediate welcome message to confirm connection
      try {
        socket.send(JSON.stringify({
          type: "connection_established",
          data: {
            clientId,
            sessionId,
            timestamp: Date.now()
          }
        }));
      } catch (err) {
        console.error(`Error sending welcome message to client ${clientId}:`, err);
      }
      
      // Start ping timer for this client
      client.pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({
              type: "ping",
              timestamp: Date.now()
            }));
          } catch (err) {
            console.error(`Error sending ping to ${clientId}:`, err);
            clearInterval(client.pingTimer);
            removeClient(clientId);
          }
        } else {
          clearInterval(client.pingTimer);
          removeClient(clientId);
        }
      }, 25000) as unknown as number; // Type assertion needed for Deno
      
      // If this is a player, notify caller about join
      if (clientType === 'player' && playerCode) {
        notifyCaller(sessionId, {
          type: "player_joined",
          data: {
            playerCode,
            playerName,
            timestamp: Date.now()
          }
        });
      }
    };
    
    socket.onmessage = (event) => {
      try {
        // Update last activity timestamp
        client.lastActivity = Date.now();
        
        // Handle pong messages specially
        if (event.data === 'pong' || (typeof event.data === 'string' && event.data.includes('"type":"pong"'))) {
          return; // Nothing else to do for pong messages
        }
        
        // Parse and handle message
        const message = JSON.parse(event.data);
        
        // Add sessionId to message if not present
        if (!message.sessionId) {
          message.sessionId = sessionId;
        }
        
        // Route message based on client type
        if (client.type === "player") {
          handlePlayerMessage(client, message);
        } else if (client.type === "caller") {
          handleCallerMessage(client, message);
        }
      } catch (err) {
        console.error(`Error processing message from client ${clientId}:`, err);
        // Don't remove client for parse errors
      }
    };
    
    socket.onclose = (event) => {
      logWithTimestamp(`WebSocket closed for client ${clientId}: code=${event.code}, reason=${event.reason}`);
      removeClient(clientId);
    };
    
    socket.onerror = (event) => {
      logWithTimestamp(`WebSocket error for client ${clientId}`);
      console.error("Socket error:", event);
      removeClient(clientId);
    };
    
    return response;
  } catch (error) {
    console.error("Error handling connection:", error);
    return new Response(`Internal Server Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
