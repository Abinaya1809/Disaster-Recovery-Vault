import { SNSClient, PublishCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import { config } from '../config/env';
import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

class NotificationService {
  private snsClient: SNSClient | null = null;
  private topicArn: string = config.AWS.SNS_TOPIC_ARN;

  constructor() {
    if (!config.MOCK_AWS && this.topicArn) {
      try {
        this.snsClient = new SNSClient({
          region: config.AWS.REGION,
          credentials: {
            accessKeyId: config.AWS.ACCESS_KEY_ID,
            secretAccessKey: config.AWS.SECRET_ACCESS_KEY,
          },
        });
        console.log('[SNS] SNS Notification Service initialized.');
      } catch (err) {
        console.error('[SNS] Failed to initialize SNS client. Falling back to internal logs.', err);
      }
    } else {
      console.log('[SNS] SNS Service Initialized in Local Fallback mode.');
    }
  }

  /**
   * Broadcasts a notification to the user in app (DB) and emails them via SNS if active
   */
  public async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string
  ): Promise<void> {
    // 1. Always record in database so users can view alerts in their dashboard
    try {
      await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          isRead: false,
        },
      });
    } catch (err) {
      console.error('[SNS] Failed to create database notification record', err);
    }

    // 2. Broadcast via AWS SNS if credentials are valid and setup is available
    if (this.snsClient && this.topicArn) {
      try {
        const publishCommand = new PublishCommand({
          TopicArn: this.topicArn,
          Subject: `[DR Vault Alert] ${title}`,
          Message: `Notification: ${message}\n\nType: ${type}\nDate: ${new Date().toUTCString()}`,
        });
        await this.snsClient.send(publishCommand);
        console.log(`[SNS] Successfully dispatched AWS SNS alert: ${title}`);
        return;
      } catch (err) {
        console.error('[SNS] Failed to publish message via AWS SNS. Logged internally.', err);
      }
    }

    // Local Emulation Logs
    console.log(`[SNS Fallback Notification] [${type}] TO: ${userId} | TITLE: ${title} | MESSAGE: ${message}`);
  }

  /**
   * Allows users to subscribe their emails to the SNS topic for notifications
   */
  public async subscribeEmail(email: string): Promise<void> {
    if (this.snsClient && this.topicArn) {
      try {
        const command = new SubscribeCommand({
          TopicArn: this.topicArn,
          Protocol: 'email',
          Endpoint: email,
        });
        await this.snsClient.send(command);
        console.log(`[SNS] Pending subscription email sent to: ${email}`);
        return;
      } catch (err) {
        console.error('[SNS] Failed to subscribe email via AWS SNS:', err);
      }
    }
    console.log(`[SNS Fallback Subscription] Registered subscription for: ${email}`);
  }
}

export const sns = new NotificationService();
export default sns;
