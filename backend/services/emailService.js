import nodemailer from 'nodemailer';

// Create transporter. Prefer explicit SMTP settings via env (recommended for production).
// If using Gmail, set EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=465, EMAIL_SECURE=true and provide credentials.
const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST || 'smtp.gmail.com',
	port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465,
	secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true,
	auth: {
		user: process.env.EMAIL_USERNAME,
		pass: process.env.EMAIL_PASSWORD,
	},
});

export const sendVerificationEmail = async (email, otp) => {
	// Send a short numeric OTP to the user's email
	const mailOptions = {
		from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
		to: email,
		subject: 'Your verification code',
		html: `
			<p>Your verification code is:</p>
			<h2 style="letter-spacing:4px">${otp}</h2>
			<p>This code will expire in 10 minutes.</p>
		`,
	};

	return transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email, token) => {
	const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

	const mailOptions = {
		from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
		to: email,
		subject: 'Reset your password',
		html: `
			<p>Click the link below to reset your password:</p>
			<a href="${resetUrl}">${resetUrl}</a>
			<p>This link will expire in 1 hour.</p>
		`,
	};

	return transporter.sendMail(mailOptions);
};