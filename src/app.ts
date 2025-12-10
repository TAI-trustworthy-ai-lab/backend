import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

// 1. 這裡您已經引入了，很好
import llmRouter from './routes/llm.router';

import { notFoundHandler } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import requestLogger from './middlewares/requestLogger';

import { setupSwagger } from './utils/swagger';

import userRoutes from './routes/userRoutes';
import questionnaireRoutes from './routes/questionnaireRoutes';
import responseRoutes from './routes/responseRoutes';
import projectRoutes from './routes/projectRoutes';
import reportRoutes from './routes/reportRoutes';

import authRoutes from './routes/authRoutes';

const app: Application = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

// --- 路由註冊區 ---

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use('/api/response', responseRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/report', reportRoutes);

app.use('/api/llm', llmRouter); 

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: '🎉 Bienvenue sur l\'API !' });
});

setupSwagger(app);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;