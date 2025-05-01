
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Enhanced CORS headers with more allowed origins and protocols
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
  'Sec-WebSocket-Protocol': 'binary, json', // Support multiple protocols
  'Content-Type': 'application/json',
};

interface Client {
  id: string;
  socket: WebSocket;
  type: "caller" | "player";
  sessionId: string;
  playerCode?: string;
  playerName?: string;
  lastActivity: number;
}

// Store connected clients
const clients: Map<string, Client> = new Map();
// Track clients by session
const sessions: Map<string, Set<string>> = new Map(); // sessionId -> Set of client ids

// Debug logging to help troubleshoot
console.log("Bingo Hub function initialized");

// Clean up inactive connections every 30 seconds
setInterval(() => {
  const now = Date.now();
  const timeoutThreshold = 180000; // 3 minutes timeout (increased from 2 minutes)
  
  console.log(`Checking for inactive clients. Total clients: ${clients.size}`);
  
  for (const [id, client] of clients.entries()) {
    if (now - client.lastActivity > timeoutThreshold) {
      console.log(`Removing inactive client: ${id}, type: ${client.type}, session: ${client.sessionId}`);
      try {
        removeClient(id);
      } catch (err) {
        console.error(`Error removing inactive client ${id}:`, err);
      }
    }
  }
}, 30000);

function removeClient(clientId: string) {
  const client = clients.get(clientId);
  if (!client) {
    console.log(`Client ${clientId} not found for removal`);
    return;
  }
  
  // Remove from session tracking
  if (client.sessionId) {
    const sessionClients = sessions.get(client.sessionId);
    if (sessionClients) {
      sessionClients.delete(clientId);
      console.log(`Removed client ${clientId} from session ${client.sessionId}. Remaining clients in session: ${sessionClients.size}`);
      
      // If session has no more clients, remove the session
      if (sessionClients.size === 0) {
        console.log(`Session ${client.sessionId} has no more clients. Removing session.`);
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
      console.log(`Closing socket for client ${clientId}`);
      client.socket.close(1000, "Normal close");
    }
  } catch (err) {
    console.error(`Error closing socket for client ${clientId}:`, err);
  }
  
  clients.delete(clientId);
  console.log(`Client ${clientId} removed from clients map. New total: ${clients.size}`);
}

function broadcastToSession(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients || sessionClients.size === 0) {
    console.log(`No clients found for session ${sessionId} to broadcast to`);
    return;
  }
  
  const messageStr = JSON.stringify(message);
  console.log(`Broadcasting to session ${sessionId} (${sessionClients.size} clients): ${message.type}`);
  
  let sentCount = 0;
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
        sentCount++;
      } catch (err) {
        console.error(`Error sending message to client ${clientId}:`, err);
      }
    }
  }
  console.log(`Message sent to ${sentCount} clients out of ${sessionClients.size}`);
}

function broadcastToPlayers(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) {
    console.log(`No clients found for session ${sessionId}`);
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
  console.log(`Player broadcast sent to ${sentCount} players`);
}

function notifyCaller(sessionId: string, message: any) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) {
    console.log(`No clients found for session ${sessionId}`);
    return;
  }
  
  const messageStr = JSON.stringify(message);
  
  for (const clientId of sessionClients) {
    const client = clients.get(clientId);
    if (client && client.type === "caller" && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(messageStr);
        console.log(`Notified caller ${clientId} in session ${sessionId}: ${message.type}`);
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
    console.log(`Processing player message of type: ${message.type}`);

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
        console.log(`Player ${client.playerCode} claiming bingo in session ${message.sessionId}`);
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
        console.log(`Unknown player message type: ${message.type}`);
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
    console.log(`Processing caller message of type: ${message.type}`);
    
    switch (message.type) {
      case "number-called":
        // Broadcast to all players in session
        console.log(`Caller called number: ${message.data?.lastCalledNumber}, session: ${message.sessionId}`);
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
        console.log(`Caller changed pattern to: ${message.data?.pattern}, session: ${message.sessionId}`);
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
        console.log(`Caller started game in session: ${message.sessionId}`);
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
        console.log(`Caller ended game in session: ${message.sessionId}`);
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
        console.log(`Caller advanced to next game (${message.data?.gameNumber}) in session: ${message.sessionId}`);
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
          console.log(`Claim result for player ${playerCode}: ${message.data?.result}`);
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
                console.log(`Sent claim result to player ${playerCode}`);
                break;
              }
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
        console.log(`Unknown caller message type: ${message.type}`);
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

serve(async (req) => {
  console.log(`Received request to bingo-hub endpoint: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const upgradeHeader = req.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    console.log("Non-WebSocket request rejected");
    return new Response('Expected WebSocket connection', { 
      status: 400,
      headers: corsHeaders
    });
  }
  
  const url = new URL(req.url);
  console.log(`Received WebSocket connection request URL: ${req.url}`);
  
  const clientType = url.searchParams.get('type');
  if (clientType !== 'caller' && clientType !== 'player') {
    console.log(`Invalid client type: ${clientType}`);
    return new Response('Client type must be caller or player', { 
      status: 400,
      headers: corsHeaders
    });
  }
  
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    console.log("Missing sessionId parameter");
    return new Response('Session ID is required', { 
      status: 400,
      headers: corsHeaders
    });
  }
  
  const playerCode = url.searchParams.get('playerCode') || undefined;
  const playerName = url.searchParams.get('playerName') || undefined;
  
  console.log(`New WebSocket connection request: ${clientType} for session ${sessionId}, playerCode: ${playerCode}`);
  
  // Create WebSocket connection
  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const clientId = crypto.randomUUID();
    
    console.log(`WebSocket upgrade successful for clientId: ${clientId}`);
    
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
      console.log(`Added client ${clientId} to session ${sessionId}. Total clients in session: ${sessionClients.size}`);
      
      // Send welcome message
      try {
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
        console.log(`Sent welcome message to client ${clientId}`);
      } catch (err) {
        console.error(`Error sending welcome message to client ${clientId}:`, err);
      }
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
        console.error(`Error processing message from client ${clientId}: ${error}`);
        
        // Send error back to client
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({
              type: "error",
              data: {
                message: "Server error processing message",
                timestamp: Date.now()
              }
            }));
          } catch (err) {
            console.error(`Error sending error message to client ${clientId}:`, err);
          }
        }
      }
    };
    
    socket.onclose = (event) => {
      console.log(`Client ${clientId} disconnected with code ${event.code}: ${event.reason}`);
      removeClient(clientId);
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      try {
        removeClient(clientId);
      } catch (err) {
        console.error(`Error removing client ${clientId} after socket error:`, err);
      }
    };
    
    // Add improved headers to response
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
