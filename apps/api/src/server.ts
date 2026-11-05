import { createApp } from './app';
import { logger } from './lib/logger';

/** Server lokal untuk pengembangan. Di Vercel, entry-nya api/index.ts. */
const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => {
  logger.info({ port }, `SILK API berjalan di http://localhost:${port}`);
});
