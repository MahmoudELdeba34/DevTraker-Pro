import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Task, { ReminderThreshold } from '../models/Task';
import Project from '../models/Project';
import User from '../models/User';

const SMTP_CONFIGURED =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const THRESHOLD_MS: Record<ReminderThreshold, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1h': 1 * 60 * 60 * 1000,
};

async function sendReminderEmail(
  toEmail: string,
  userName: string,
  taskTitle: string,
  projectTitle: string,
  deadline: Date,
  threshold: ReminderThreshold
): Promise<void> {
  if (!SMTP_CONFIGURED) {
    console.log(
      `[ReminderCron] SMTP not configured — skipping email to ${toEmail} for task "${taskTitle}" (${threshold} threshold)`
    );
    return;
  }

  const transporter = createTransporter();
  const deadlineStr = deadline.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏰ WorkTrack</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Task Deadline Reminder</p>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="color: #333; font-size: 16px;">Hi <strong>${userName}</strong>,</p>
        <p style="color: #555;">This is a reminder that the following task is due in <strong>${threshold}</strong>:</p>
        <div style="background: white; border-left: 4px solid #667eea; padding: 16px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold; color: #222;">${taskTitle}</p>
          <p style="margin: 0 0 4px; color: #666;">📁 Project: <strong>${projectTitle}</strong></p>
          <p style="margin: 0; color: #e74c3c;">📅 Deadline: <strong>${deadlineStr}</strong></p>
        </div>
        <p style="color: #555;">Don't forget to complete this task on time. Log into WorkTrack to update its status.</p>
        <a href="${process.env.FRONTEND_URL ?? 'http://localhost:4200'}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Open WorkTrack →</a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"WorkTrack" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `⏰ Task Reminder: "${taskTitle}" due in ${threshold}`,
    html,
  });

  console.log(`[ReminderCron] Email sent to ${toEmail} for task "${taskTitle}" (${threshold})`);
}

export function startReminderCron(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[ReminderCron] Running deadline reminder check...');

    try {
      const now = new Date();

      // Get all incomplete tasks with a deadline and unsent reminders
      const tasks = await Task.find({
        deadline: { $exists: true, $ne: null },
        status: { $ne: 'completed' },
        'reminders.sent': false,
      });

      for (const task of tasks) {
        if (!task.deadline) continue;

        const msUntilDeadline = task.deadline.getTime() - now.getTime();
        if (msUntilDeadline < 0) continue; // Already overdue

        // Populate project
        const project = await Project.findById(task.projectId);
        if (!project) continue;

        // Populate user
        const user = await User.findById(project.userId);
        if (!user) continue;

        let updated = false;

        for (let i = 0; i < task.reminders.length; i++) {
          const reminder = task.reminders[i];
          if (reminder.sent) continue;

          const thresholdMs = THRESHOLD_MS[reminder.threshold];

          // Send if we're within the threshold window
          if (msUntilDeadline <= thresholdMs) {
            try {
              await sendReminderEmail(
                user.email,
                user.name,
                task.title,
                project.title,
                task.deadline,
                reminder.threshold
              );
              task.reminders[i].sent = true;
              updated = true;
            } catch (emailErr) {
              console.error(
                `[ReminderCron] Failed to send email for task ${task._id}:`,
                emailErr
              );
            }
          }
        }

        if (updated) {
          await task.save();
        }
      }

      console.log('[ReminderCron] Reminder check complete.');
    } catch (err) {
      console.error('[ReminderCron] Error during cron execution:', err);
    }
  });

  console.log('[ReminderCron] Scheduled hourly deadline reminder cron job.');
}
