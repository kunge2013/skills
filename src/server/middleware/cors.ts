import cors from 'cors';

export function setupCors() {
  return cors({
    origin: true, // Allow all origins for development
    credentials: true,
  });
}
