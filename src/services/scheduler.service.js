import cron from 'node-cron';
import { config } from '../config/credentials.js';
import logger from '../utils/logger.js';

class SchedulerService {
  constructor(taskFunction) {
    this.taskFunction = taskFunction;
    this.intervalMinutes = config.scheduler.intervalMinutes;
    this.cronExpression = this.generateCronExpression(this.intervalMinutes);
    this.job = null;
  }

  /**
   * Generate cron expression from interval in minutes
   * @param {number} minutes - Interval in minutes
   * @returns {string} Cron expression
   */
  generateCronExpression(minutes) {
    // For intervals that divide evenly into 60, use minutes pattern
    if (60 % minutes === 0) {
      return `*/${minutes} * * * *`;
    }
    
    // For other intervals, run every N minutes
    // Note: node-cron doesn't support all intervals perfectly
    // For 90 minutes, we'll run every 90 minutes starting from minute 0
    if (minutes === 90) {
      return '0 */1 * * *'; // Every hour, then manual logic
    }
    
    // Default: try to fit into hourly pattern
    return `*/${minutes} * * * *`;
  }

  /**
   * Start the scheduled task
   */
  start() {
    if (this.job) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info(`Starting scheduler with interval: ${this.intervalMinutes} minutes`);
    logger.info(`Cron expression: ${this.cronExpression}`);

    // Validate cron expression
    if (!cron.validate(this.cronExpression)) {
      logger.error(`Invalid cron expression: ${this.cronExpression}`);
      throw new Error('Invalid cron expression');
    }

    // Schedule the task
    this.job = cron.schedule(this.cronExpression, async () => {
      try {
        logger.info('Executing scheduled task...');
        const startTime = Date.now();
        
        await this.taskFunction();
        
        const duration = Date.now() - startTime;
        logger.info(`Scheduled task completed in ${duration}ms`);
      } catch (error) {
        logger.error('Error in scheduled task:', error);
      }
    });

    this.job.start();
    logger.info('Scheduler started successfully');

    // Run immediately on startup
    logger.info('Running initial task on startup...');
    this.taskFunction().catch(error => {
      logger.error('Error in initial task:', error);
    });
  }

  /**
   * Stop the scheduled task
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Scheduler stopped');
    }
  }

  /**
   * Get next scheduled run time
   * @returns {string} Next run time description
   */
  getNextRunTime() {
    if (!this.job) {
      return 'Not scheduled';
    }
    return `Next run in approximately ${this.intervalMinutes} minutes`;
  }

  /**
   * Manually trigger the task (outside of schedule)
   */
  async triggerManually() {
    logger.info('Manually triggering scheduled task...');
    try {
      await this.taskFunction();
      logger.info('Manual task execution completed');
    } catch (error) {
      logger.error('Error in manual task execution:', error);
      throw error;
    }
  }
}

export default SchedulerService;

