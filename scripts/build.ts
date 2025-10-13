import fs from 'fs-extra';
import logger from 'jet-logger';
import childProcess from 'child_process';

(async () => {
  try {
    await remove('./dist/');
    await exec('tsc --build tsconfig.prod.json', './');
    await copy('./temp/config.js', './config.js');
    await copy('./temp/src', './dist');
    console.log("Verifying dist content:");
    await exec('ls -la ./dist', './');
    await remove('./temp/');
  } catch (err) {
    logger.err(err);
    process.exit(1);
  }
})();

function remove(loc: string): Promise<void> {
  return new Promise((res, rej) => {
    return fs.remove(loc, err => {
      return (!!err ? rej(err) : res());
    });
  });
}

function copy(src: string, dest: string): Promise<void> {
  return new Promise((res, rej) => {
    return fs.copy(src, dest, err => {
      return (!!err ? rej(err) : res());
    });
  });
}

function exec(cmd: string, loc: string): Promise<void> {
  return new Promise((res, rej) => {
    return childProcess.exec(cmd, { cwd: loc }, (err, stdout, stderr) => {
      if (!!stdout) {
        logger.info(stdout);
      }
      if (!!stderr) {
        logger.warn(stderr);
      }
      return (!!err ? rej(err) : res());
    });
  });
}
