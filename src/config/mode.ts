export function isClientMode() {
  return (process.env.API_MODE === 'client' || process.env.RUN_AS_CLIENT === 'true');
}

export const API_URL = process.env.API_URL || 'http://localhost:3000';
