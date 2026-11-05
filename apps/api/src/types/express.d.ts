import type { SessionUser, SessionInfo } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      auth?: { user: SessionUser; session: SessionInfo };
    }
  }
}

export {};
