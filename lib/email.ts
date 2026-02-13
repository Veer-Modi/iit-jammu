import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  // Hardcoded credentials as requested by user
  const user = 'khichiptatik90@gmail.com';
  const pass = 'uauldcpyytshbosz';

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: {
      ciphers: 'SSLv3'
    },
    // Force IPv4 to avoid ENETUNREACH errors with IPv6
    family: 4
  });
  return transporter;
}

// Helper to generate professional HTML email
function getHtmlTemplate(title: string, bodyContent: string, actionUrl?: string, actionText?: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 32px; }
        .content h2 { margin-top: 0; color: #1f2937; font-size: 20px; }
        .content p { color: #4b5563; margin-bottom: 16px; }
        .btn-container { text-align: center; margin-top: 32px; margin-bottom: 32px; }
        .btn { display: inline-block; background-color: #3B82F6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center; transition: background-color 0.2s; }
        .btn:hover { background-color: #2563EB; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TaskFlow</h1>
        </div>
        <div class="content">
          ${bodyContent}
          ${actionUrl && actionText ? `
            <div class="btn-container">
              <a href="${actionUrl}" class="btn">${actionText}</a>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} TaskFlow. All rights reserved.</p>
          <p>You received this email because you are part of a TaskFlow workspace.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`📧 Attempting to send email to: ${to}, subject: "${subject}"`);
  // Ensure transporter is initialized
  if (!transporter) {
    getTransporter(); // Attempt to initialize if not already
  }

  if (!transporter) {
    console.error('❌ Email transporter not configured');
    throw new Error('Email service not configured');
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
}

export async function sendTrialApproved(to: string, firstName: string, loginUrl: string) {
  const content = `
    <h2>Hi ${firstName}!</h2>
    <p>We are thrilled to welcome you to TaskFlow! Your 7-day free trial has been approved and your account is fully active.</p>
    <p>Experience the power of seamless task management and team collaboration starting today.</p>
  `;
  return sendEmail(to, 'Welcome to TaskFlow! Your Trial is Ready 🚀', getHtmlTemplate('Your Trial is Ready', content, loginUrl, 'Start Your Trial'));
}

export async function sendWorkspaceCreated(to: string, workspaceName: string, loginUrl: string) {
  const content = `
    <h2>You've been added to a Workspace</h2>
    <p>You have been invited to join the workspace <strong>${workspaceName}</strong>.</p>
    <p>Collaborate with your team, manage tasks, and track progress in one place.</p>
  `;
  return sendEmail(to, `Invitation to ${workspaceName}`, getHtmlTemplate('Workspace Invitation', content, loginUrl, 'Join Workspace'));
}

export async function sendProjectCreated(to: string, projectName: string, workspaceName: string, loginUrl: string) {
  const content = `
    <h2>New Project Created</h2>
    <p>A new project <strong>${projectName}</strong> has been kicked off in <strong>${workspaceName}</strong>.</p>
    <p>Check out the project board to see tasks and get involved.</p>
  `;
  return sendEmail(to, `New Project: ${projectName}`, getHtmlTemplate('New Project', content, loginUrl, 'View Project'));
}

export async function sendTaskAssigned(to: string, taskTitle: string, projectName: string, assignerName: string, loginUrl: string) {
  const content = `
    <h2>New Task Assignment</h2>
    <p><strong>${assignerName}</strong> has assigned you a new task:</p>
    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-weight: 600;">${taskTitle}</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Project: ${projectName}</p>
    </div>
    <p>Please review the details and confirm the status.</p>
  `;
  return sendEmail(to, `Task Assigned: ${taskTitle}`, getHtmlTemplate('Task Assignment', content, loginUrl, 'View Task'));
}

export async function sendEmployeeCredentials(to: string, firstName: string, email: string, tempPassword: string, loginUrl: string) {
  const content = `
    <h2>Hi ${firstName}!</h2>
    <p>Your TaskFlow account has been created. Use these credentials to log in:</p>
    <div style="background-color: #eef2ff; padding: 16px; border-radius: 8px; border: 1px solid #c7d2fe; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 0;"><strong>Password:</strong> ${tempPassword}</p>
    </div>
    <p style="font-size: 14px; color: #dc2626;">Please change your password after first login.</p>
  `;
  return sendEmail(to, 'Your TaskFlow Credentials', getHtmlTemplate('Welcome Aboard', content, loginUrl, 'Log In Now'));
}
