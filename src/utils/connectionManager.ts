
// Redirect all calls to the new SingleSourceTrueConnections implementation
// This file is kept only for backward compatibility
export { getSingleSourceConnection as connectionManager } from './SingleSourceTrueConnections';
export { getSingleSourceConnection } from './SingleSourceTrueConnections';
