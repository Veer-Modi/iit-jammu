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
  return sendEmail(
    to,
    'Your TaskFlow 7-Day Trial is Ready!',
    `
    <h2>Hi ${firstName}!</h2>
    <p>Your 7-day free trial for TaskFlow has been approved. You can now log in and start using the application.</p>
    <p><a href="${loginUrl}" style="background:#3B82F6;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Log In Now</a></p>
    <p>Enjoy 7 days of full access. Questions? Reply to this email.</p>
    <p>— TaskFlow Team</p>
    `
  );
}

export async function sendWorkspaceCreated(to: string, workspaceName: string, loginUrl: string) {
  return sendEmail(
    to,
    `You've been added to workspace: ${workspaceName}`,
    `
    <h2>Workspace Invitation</h2>
    <p>You've been added to the workspace <strong>${workspaceName}</strong> on TaskFlow.</p>
    <p><a href="${loginUrl}">Log in to get started</a></p>
    <p>— TaskFlow</p>
    `
  );
}

export async function sendProjectCreated(to: string, projectName: string, workspaceName: string, loginUrl: string) {
  return sendEmail(
    to,
    `New project: ${projectName}`,
    `
    <h2>New Project</h2>
    <p>A new project <strong>${projectName}</strong> has been created in workspace <strong>${workspaceName}</strong>.</p>
    <p><a href="${loginUrl}">View project</a></p>
    <p>— TaskFlow</p>
    `
  );
}

export async function sendTaskAssigned(to: string, taskTitle: string, projectName: string, assignerName: string, loginUrl: string) {
  return sendEmail(
    to,
    `Task assigned: ${taskTitle}`,
    `
    <h2>Task Assigned</h2>
    <p><strong>${assignerName}</strong> assigned you a task: <strong>${taskTitle}</strong></p>
    <p>Project: ${projectName}</p>
    <p><a href="${loginUrl}">View task</a></p>
    <p>— TaskFlow</p>
    `
  );
}

export async function sendEmployeeCredentials(to: string, firstName: string, email: string, tempPassword: string, loginUrl: string) {
  return sendEmail(
    to,
    'Your TaskFlow account credentials',
    `
    <h2>Hi ${firstName}!</h2>
    <p>Your TaskFlow account has been created. Use these credentials to log in:</p>
    <p><strong>Email:</strong> ${email}<br><strong>Password:</strong> ${tempPassword}</p>
    <p><strong>Please change your password after first login.</strong></p>
    <p><a href="${loginUrl}" style="background:#3B82F6;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Log In</a></p>
    <p>— TaskFlow Team</p>
    `
  );
}
