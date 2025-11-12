import nodemailer from "nodemailer";

// Create transporter. Prefer explicit SMTP settings via env (recommended for production).
// If using Gmail, set EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=465, EMAIL_SECURE=true and provide credentials.
const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST || "smtp.gmail.com",
	port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465,
	secure: process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === "true" : true,
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
		subject: "Your verification code",
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
		subject: "Reset your password",
		html: `
			<p>Click the link below to reset your password:</p>
			<a href="${resetUrl}">${resetUrl}</a>
			<p>This link will expire in 1 hour.</p>
		`,
	};

	return transporter.sendMail(mailOptions);
};

const escapeHtml = (value = "") =>
	value
		.toString()
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");

export const sendPostPublicationEmail = async ({
	recipients,
	author = {},
	post = {},
	preview = "",
	signature = "Thank you for reading!",
}) => {
	if (!Array.isArray(recipients) || recipients.length === 0) {
		return;
	}

	const bcc = Array.from(
		new Set(
			recipients
				.filter((email) => typeof email === "string")
				.map((email) => email.trim().toLowerCase())
				.filter(Boolean)
		)
	);

	if (bcc.length === 0) {
		return;
	}

	const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME;
	if (!fromAddress) {
		throw new Error("Email sender is not configured");
	}

	const authorDisplayName =
		author.displayName || author.name || author.username || "A BlogsHive creator";
	const storyTitle = post.title || "A new story";
	const storyUrl = post.url;
	const normalizedPreview = preview && preview.trim().length > 0
		? preview.trim()
		: post.subtitle && post.subtitle.trim().length > 0
		? post.subtitle.trim()
		: "Dive into the full story to see what's new.";
	const closingLine = signature && signature.trim().length > 0
		? signature.trim()
		: "Thank you for reading!";

	const introLine = `${authorDisplayName} just published a new story on BlogsHive.`;
	const htmlParts = [
		"<p style=\"font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; color: #1f2933;\">Hello,</p>",
		`<p style=\"font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; color: #1f2933;\">${escapeHtml(
			introLine
		)}</p>`,
		`<h2 style=\"font-family: 'Segoe UI', Arial, sans-serif; font-size: 20px; color: #111827; margin: 24px 0 12px;\">${escapeHtml(
			storyTitle
		)}</h2>`,
	];

	if (normalizedPreview) {
		htmlParts.push(
			`<p style=\"font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; color: #374151; line-height: 1.6;\">${escapeHtml(
				normalizedPreview
			)}</p>`
		);
	}

	if (storyUrl) {
		htmlParts.push(
			`<p style=\"margin: 28px 0;\"><a href=\"${storyUrl}\" style=\"display: inline-block; background: #1f2937; color: #ffffff; padding: 12px 20px; border-radius: 6px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; text-decoration: none;\">Read the story</a></p>`
		);
	}

	htmlParts.push(
		`<p style=\"font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #4b5563; margin-top: 32px;\">${escapeHtml(
			closingLine
		)}</p>`
	);

	const html = htmlParts.join("");
	const textLines = [
		"Hello,",
		"",
		introLine,
		"",
		storyTitle,
	];

	if (normalizedPreview) {
		textLines.push("", normalizedPreview);
	}

	if (storyUrl) {
		textLines.push("", `Read the story: ${storyUrl}`);
	}

	textLines.push("", closingLine);

	const mailOptions = {
		from: fromAddress,
		to: fromAddress,
		bcc,
		subject: `${authorDisplayName} just published "${storyTitle}"`,
		html,
		text: textLines.join("\n"),
	};

	return transporter.sendMail(mailOptions);
};