import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';

class MonitoringService {
  private cwClient: CloudWatchClient | null = null;
  private logDirectory = path.join(__dirname, '../../../logs');

  constructor() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }

    if (!config.MOCK_AWS) {
      try {
        this.cwClient = new CloudWatchClient({
          region: config.AWS.REGION,
          credentials: {
            accessKeyId: config.AWS.ACCESS_KEY_ID,
            secretAccessKey: config.AWS.SECRET_ACCESS_KEY,
          },
        });
        console.log('[CloudWatch] CloudWatch monitoring initialized in AWS mode.');
      } catch (err) {
        console.error('[CloudWatch] Failed to initialize AWS CloudWatch. Falling back to local logging.', err);
      }
    } else {
      console.log('[CloudWatch] CloudWatch initialized in Local Fallback mode.');
    }
  }

  // Generic metric logging
  public async putMetric(metricName: string, value: number, unit: 'Count' | 'Milliseconds' | 'Percent' | 'Bytes') {
    const timestamp = new Date();
    
    // Always write to local logs
    const logLine = `[Metric] ${timestamp.toISOString()} - ${metricName}: ${value} ${unit}\n`;
    fs.appendFileSync(path.join(this.logDirectory, 'metrics.log'), logLine);

    if (this.cwClient) {
      try {
        const command = new PutMetricDataCommand({
          Namespace: 'DRVault',
          MetricData: [
            {
              MetricName: metricName,
              Value: value,
              Unit: unit,
              Timestamp: timestamp,
            },
          ],
        });
        await this.cwClient.send(command);
      } catch (err) {
        console.error(`[CloudWatch] Error publishing metric ${metricName}:`, err);
      }
    }
  }

  public async logError(message: string, details: any = {}) {
    const timestamp = new Date().toISOString();
    const logData = JSON.stringify({ timestamp, message, ...details }, null, 2);
    
    // Append to local errors.log
    fs.appendFileSync(path.join(this.logDirectory, 'errors.log'), `${logData}\n---\n`);
    
    await this.putMetric('APIErrors', 1, 'Count');
  }

  public async recordApiCall(method: string, pathStr: string, durationMs: number) {
    await this.putMetric('APICallDuration', durationMs, 'Milliseconds');
    await this.putMetric('APICallCount', 1, 'Count');
  }

  public async recordBackupSuccess() {
    await this.putMetric('BackupSuccess', 1, 'Count');
  }

  public async recordBackupFailure() {
    await this.putMetric('BackupFailure', 1, 'Count');
  }

  public async recordRecoverySuccess() {
    await this.putMetric('RecoverySuccess', 1, 'Count');
  }

  public async recordRecoveryFailure() {
    await this.putMetric('RecoveryFailure', 1, 'Count');
  }

  public async recordUploadTime(durationMs: number) {
    await this.putMetric('UploadTime', durationMs, 'Milliseconds');
  }

  public async recordLambdaExecution(lambdaName: string, durationMs: number, success: boolean) {
    await this.putMetric(`Lambda_${lambdaName}_Duration`, durationMs, 'Milliseconds');
    await this.putMetric(`Lambda_${lambdaName}_Success`, success ? 1 : 0, 'Count');
  }
}

export const monitor = new MonitoringService();
export default monitor;
