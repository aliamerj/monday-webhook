import express from 'express';
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import { handleWebhook } from './controllers/webhook.controller';
import { handleAuthorization, handleOauth } from './controllers/oauth.controller';
import { withMondayAuth } from './middlewares/authentication';

// Initialize dotenv to load environment variables from .env file
dotenv.config()

const app = express();

// Use Helmet for setting security-related HTTP headers
app.use(helmet())

// Use Morgan for logging HTTP requests
app.use(morgan("dev"));

// Middleware to parse JSON bodies
app.use(express.json());

// routes
app.get('/authorization', handleAuthorization)
app.get('/oauth/callback', handleOauth)
app.post('/webhooks/dependency', withMondayAuth, handleWebhook)


export default app;
