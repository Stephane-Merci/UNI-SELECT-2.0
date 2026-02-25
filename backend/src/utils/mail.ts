import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '2525'), // 2525 works on Render (587/465 are blocked)
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10s — fail fast instead of hanging the request
    greetingTimeout: 10000,
    socketTimeout: 10000,
});

export const sendMail = async (to: string, subject: string, text: string, html?: string) => {
    const mailOptions = {
        from: `"UNISELECT 2.0" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        // Non-fatal: log but never throw — email failure must NOT block registration or other flows
        console.error('Error sending email (non-fatal):', error);
        return null;
    }
};
