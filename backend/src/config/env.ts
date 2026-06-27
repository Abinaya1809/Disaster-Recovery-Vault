import dotenv from 'dotenv';
import path from 'path';

// Load environmental variables
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dr_vault_user:dr_vault_secure_password@localhost:5432/dr_vault_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'dr_vault_jwt_secret_key_change_in_production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dr_vault_jwt_refresh_secret_key_change_in_production',
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',
  
  // AWS Configuration
  AWS: {
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    REGION: process.env.AWS_REGION || 'us-east-1',
    S3_BUCKET: process.env.AWS_S3_BUCKET || 'dr-vault-backups-free-tier',
    SNS_TOPIC_ARN: process.env.AWS_SNS_TOPIC_ARN || '',
  },
  
  // DR Vault Settings
  MOCK_AWS: process.env.MOCK_AWS === 'true' || !process.env.AWS_ACCESS_KEY_ID,
  STORAGE_PATH: process.env.STORAGE_PATH || path.join(__dirname, '../../../storage'),
  
  // Rate Limiting (Requests per 15 minutes)
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};
