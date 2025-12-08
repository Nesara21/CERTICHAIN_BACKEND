const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.testAccount = null;
    }

    async initialize() {
        try {
            if (process.env.SMTP_HOST) {
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
                console.log('📧 Email service initialized with SMTP');
            } else {
                // Create a test account with Ethereal Email
                this.testAccount = await nodemailer.createTestAccount();

                // Create transporter with Ethereal SMTP
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: this.testAccount.user,
                        pass: this.testAccount.pass
                    }
                });
                console.log('📧 Email service initialized with Ethereal Email (Dev Mode)');
                if (this.testAccount) console.log(`   Test account: ${this.testAccount.user}`);
            }

            console.log('📧 Email service initialized with Ethereal Email');
            console.log(`   Test account: ${this.testAccount.user}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error);
            return false;
        }
    }

    async sendPasswordResetEmail(to, resetToken, userName) {
        if (!this.transporter) {
            await this.initialize();
        }

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

        const mailOptions = {
            from: '"CertiChain" <noreply@certichain.com>',
            to: to,
            subject: 'Password Reset Request - CertiChain',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔐 Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello ${userName || 'User'},</p>
                            <p>We received a request to reset your password for your CertiChain account.</p>
                            <p>Click the button below to reset your password:</p>
                            <p style="text-align: center;">
                                <a href="${resetUrl}" class="button">Reset Password</a>
                            </p>
                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
                                ${resetUrl}
                            </p>
                            <div class="warning">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>This link will expire in <strong>1 hour</strong></li>
                                    <li>If you didn't request this reset, please ignore this email</li>
                                    <li>Your password won't change until you create a new one</li>
                                </ul>
                            </div>
                        </div>
                        <div class="footer">
                            <p>This is an automated email from CertiChain. Please do not reply.</p>
                            <p>&copy; 2025 CertiChain - Secure Certificate Management System</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Password Reset Request - CertiChain
                
                Hello ${userName || 'User'},
                
                We received a request to reset your password for your CertiChain account.
                
                Click the link below to reset your password:
                ${resetUrl}
                
                This link will expire in 1 hour.
                
                If you didn't request this reset, please ignore this email.
                
                - CertiChain Team
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);

            // Log the preview URL for Ethereal
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('📧 Password reset email sent!');
            console.log(`   Preview URL: ${previewUrl}`);

            return {
                success: true,
                messageId: info.messageId,
                previewUrl: previewUrl
            };
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    async sendStatusUpdateEmail(to, status, studentName, details = {}) {
        if (!this.transporter) {
            await this.initialize();
        }

        const templates = {
            'Submitted': {
                subject: 'Request Received - CertiChain',
                message: 'Your certificate request has been successfully submitted and is pending review.'
            },
            'Approved': {
                subject: 'Request Approved - CertiChain',
                message: 'Good news! Your certificate request has been approved by the institute and is now being processed.'
            },
            'Generating': {
                subject: 'Certificate Generating - CertiChain',
                message: 'Your certificate is currently being generated and secured on the blockchain. This may take a few moments.'
            },
            'Ready': {
                subject: 'Certificate Ready! - CertiChain',
                message: `Your certificate is ready for download. <br><br> <a href="${details.downloadLink}" class="button">Download Certificate</a>`
            },
            'Rejected': {
                subject: 'Request Rejected - CertiChain',
                message: `Your certificate request was rejected. <br><br> <strong>Reason:</strong> ${details.reason || 'Not specified'}`
            }
        };

        const template = templates[status];
        if (!template) {
            console.warn(`No email template for status: ${status}`);
            return { success: false, error: 'Unknown status' };
        }

        const mailOptions = {
            from: '"CertiChain" <noreply@certichain.com>',
            to: to,
            subject: template.subject,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                        .content { padding: 30px; }
                        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; color: white; background-color: #667eea; margin-bottom: 15px; }
                        .button { display: inline-block; padding: 12px 25px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
                        .footer { background-color: #f9f9f9; text-align: center; padding: 20px; color: #888; font-size: 12px; border-top: 1px solid #eee; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Certificate Status Update</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${studentName || 'Student'}</strong>,</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <span class="status-badge">${status}</span>
                            </div>
                            <p>${template.message}</p>
                            ${status === 'Ready' ? '' : '<p>We will notify you of any further updates.</p>'}
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 CertiChain. All rights reserved.</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`📧 Status update email (${status}) sent to ${to}`);
            console.log(`   Preview URL: ${previewUrl}`);
            return { success: true, messageId: info.messageId, previewUrl };
        } catch (error) {
            console.error('❌ Failed to send status email:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
const emailService = new EmailService();
module.exports = emailService;
