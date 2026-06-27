import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';
import { config } from './config/env';
import authRoutes from './routes/auth.routes';
import fileRoutes from './routes/file.routes';
import backupRoutes from './routes/backup.routes';
import recoveryRoutes from './routes/recovery.routes';
import adminRoutes from './routes/admin.routes';
import shareRoutes from './routes/share.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middlewares/error';
import { monitor } from './services/monitoring.service';

const app = express();
const prisma = new PrismaClient();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Request parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom API Performance Monitoring Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('/health') && !req.path.includes('/metrics') && !req.path.includes('/logs')) {
      monitor.recordApiCall(req.method, req.path, duration).catch(err => 
        console.error('Error logging performance metric:', err)
      );
    }
  });
  next();
});

// Health Check Endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
  }

  res.json({
    status: 'ok',
    environment: config.NODE_ENV,
    database: dbStatus,
    storage: config.MOCK_AWS ? 'local-fallback' : 'aws-s3-connected',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/users', userRoutes);

// Server Root Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Disaster Recovery Vault API',
    timestamp: new Date().toISOString(),
    awsMode: !config.MOCK_AWS ? 'AWS Cloud Connected' : 'Local Storage Fallback (Emulated)',
  });
});

// Central Error Interception Middleware
app.use(errorHandler);

// Launch Express Server — use process.env.PORT directly for Render compatibility
const PORT = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV = process.env.NODE_ENV || "development";

app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`  Disaster Recovery Vault API Server Running`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Environment: ${NODE_ENV}`);
  console.log(`  Database: ${config.DATABASE_URL ? 'Configured' : 'Missing'}`);
  console.log(`  AWS Mode: ${!config.MOCK_AWS ? 'AWS Cloud Active' : 'Local Emulation Active'}`);
  console.log(`==================================================`);
});
