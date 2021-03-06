import 'babel-polyfill';
import { get } from 'lodash';

import app from './app';
import config from '../shared/config';
import log, { error } from '../shared/log';

process.on('uncaughtException', error);

Promise.config({
  warnings: false,
  longStackTraces: true,
  cancellation: false,
  monitoring: false,
});

export { default as app } from './app';

export const server = (async () => {
  if (get(process, 'env.TEST', false)) {
    return null;
  }

  const appInstance = await app();
  const port = parseInt(get(process, 'env.SERVER_PORT', config.port), 10);
  const server = appInstance.listen(port, () =>
    log(`app-${appInstance.instance} is started on port ${port}`));

  if (process.send) {
    process.send({ cmd: 'started', ctx: config });
  }

  const stop = () => new Promise((resolve) => {
    log('stop signal');

    if (appInstance) {
      log('cleanup');
      appInstance.shutdown();
    }

    if (server) {
      log('close server');
      server.close(() => resolve);
    }

    resolve();
  });

  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      stop();
      log('exit');
      process.exit(0);
    }
  });

  process.once('SIGINT', stop);

  return {
    instance: server,
    stop,
  };
})();
