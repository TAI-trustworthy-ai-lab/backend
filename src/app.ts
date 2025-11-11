import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { notFoundHandler } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import requestLogger from './middlewares/requestLogger';

import { setupSwagger } from './utils/swagger';

import userRoutes from './routes/userRoutes';
import questionnaireRoutes from './routes/questionnaireRoutes';
import responseRoutes from './routes/responseRoutes';
import projectRoutes from './routes/projectRoutes';

const app: Application = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

app.use('/api/user', userRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use('/api/response', responseRoutes);
app.use('/api/project', projectRoutes);

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: '🎉 Bienvenue sur l\'API !' });
});

setupSwagger(app);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
