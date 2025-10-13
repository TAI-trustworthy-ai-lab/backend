import path from 'path';
import dotenv from 'dotenv';
import moduleAlias from 'module-alias';

const env = process.env.NODE_ENV || 'development';

if (env === 'development') {
  const result = dotenv.config({
    path: path.join(__dirname, 'config', '.env.local'),
  });

  if (result.error) {
    console.error(`Erreur lors du chargement du fichier de configuration`);
    throw result.error;
  }
}

if (__filename.endsWith('.js')) {
  moduleAlias.addAlias('@src', path.join(__dirname, 'dist'));
} else {
  moduleAlias.addAlias('@src', __dirname);
}