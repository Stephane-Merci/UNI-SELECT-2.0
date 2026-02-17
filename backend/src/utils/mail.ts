import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
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
        console.error('Error sending email:', error);
        // In dev, don't throw to avoid blocking the whole process if SMTP is not configured
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
    }
};
