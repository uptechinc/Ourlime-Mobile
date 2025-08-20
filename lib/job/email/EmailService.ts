import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

export class EmailService {
	private static instance: EmailService;

	public static getInstance(): EmailService {
		if (!EmailService.instance) {
			EmailService.instance = new EmailService();
		}
		return EmailService.instance;
	}

	async sendApplicationNotification(
		to: string,
		from: string,
		applicationData: any
	) {
		// Debug log
		console.log('EmailService applicationData:', applicationData);
		console.log('EmailService jobType:', applicationData.jobType, 'jobTitle:', applicationData.jobTitle);

		// Helper to robustly render a field if present and not empty/null/undefined
		const renderField = (label: string, value: any, isLink = false) => {
			if (!value || value === 'undefined' || value === 'null' || (typeof value === 'string' && value.trim() === '')) return '';
			if (isLink) {
				return `<p style="margin: 0 0 10px; color: #374151;"><strong>${label}:</strong> <a href="${value}" style="color: #00ff5e;">${value}</a></p>`;
			}
			return `<p style="margin: 0 0 10px; color: #374151;"><strong>${label}:</strong> ${value}</p>`;
		};

		// Helper for screening questions
		const renderScreeningSection = (answers: any) => {
			if (!answers || !Array.isArray(answers) || answers.length === 0) return '';
			return `<div style="margin-bottom: 30px;"><h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Screening Questions</h3>${answers
				.map(
					(answer: any) =>
						`<div style="margin-bottom: 15px;"><p style="margin: 0 0 5px; color: #4b5563; font-weight: 600;">${answer.question || ''}</p><p style="margin: 0; color: #374151;">${answer.response || ''}</p></div>`
				)
				.join('')}</div>`;
		};

		let subject = 'New Job Application';
		let html = '';

		switch (applicationData.jobType) {
			case 'professional': {
				subject = `New Professional Job Application: ${applicationData.jobTitle}`;
				const applicantDetails = `
					<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
						<h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Applicant Details</h3>
						${renderField('Name', applicationData.applicantName)}
						${renderField('Email', applicationData.applicantEmail, true)}
						${renderField('Portfolio', applicationData.portfolioLink, true)}
						${renderField('Resume', applicationData.resumeUrl, true)}
					</div>
				`;
				html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>${subject}</title>
				</head>
				<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
					<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
						<tr>
							<td>
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
									<tr>
										<td style="background: linear-gradient(to right, #00ff5e, #00e676); padding: 40px 40px; text-align: center;">
											<img src="https://ourlime.com/images/transparentLogo.png" alt="Ourlime Logo" width="150" style="margin-bottom: 20px;" />
											<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${subject}</h1>
										</td>
									</tr>
									<tr>
										<td style="padding: 40px;">
											<h2 style="color: #111827; margin: 0 0 20px; font-size: 20px;">Position: ${applicationData.jobTitle || ''}</h2>
											${applicantDetails}
											${applicationData.coverLetter ? `<div style="margin-bottom: 30px;"><h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Cover Letter</h3><p style="margin: 0; color: #374151; line-height: 1.6;">${applicationData.coverLetter}</p></div>` : ''}
											${renderScreeningSection(applicationData.answers)}
										</td>
									</tr>
									<tr>
										<td style="background-color: #f3f4f6; padding: 20px 40px; text-align: center;">
											<p style="margin: 0; color: #6b7280; font-size: 14px;">This is an automated message from Ourlime Platform</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</body>
				</html>
				`;
				break;
			}
			case 'freelance-gig': {
				subject = `New Proposal for Your Freelance Gig: ${applicationData.jobTitle}`;
				const applicantDetails = `
					<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
						<h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Applicant Details</h3>
						${renderField('Name', applicationData.applicantName)}
						${renderField('Email', applicationData.applicantEmail, true)}
						${renderField('Portfolio', applicationData.portfolioLink, true)}
					</div>
				`;
				html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>${subject}</title>
				</head>
				<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
					<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
						<tr>
							<td>
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
									<tr>
										<td style="background: linear-gradient(to right, #00ff5e, #00e676); padding: 40px 40px; text-align: center;">
											<img src="https://ourlime.com/images/transparentLogo.png" alt="Ourlime Logo" width="150" style="margin-bottom: 20px;" />
											<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${subject}</h1>
										</td>
									</tr>
									<tr>
										<td style="padding: 40px;">
											<h2 style="color: #111827; margin: 0 0 20px; font-size: 20px;">Gig: ${applicationData.jobTitle || ''}</h2>
											${applicantDetails}
											${applicationData.coverLetter ? `<div style="margin-bottom: 30px;"><h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Proposal</h3><p style="margin: 0; color: #374151; line-height: 1.6;">${applicationData.coverLetter}</p></div>` : ''}
											${renderScreeningSection(applicationData.answers)}
										</td>
									</tr>
									<tr>
										<td style="background-color: #f3f4f6; padding: 20px 40px; text-align: center;">
											<p style="margin: 0; color: #6b7280; font-size: 14px;">This is an automated message from Ourlime Platform</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</body>
				</html>
				`;
				break;
			}
			case 'freelance': {
				subject = `New Client Contact: ${applicationData.jobTitle || 'Freelance Opportunity'}`;
				const applicantDetails = `
					<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
						<h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Applicant Details</h3>
						${renderField('Name', applicationData.applicantName)}
						${renderField('Email', applicationData.applicantEmail, true)}
					</div>
				`;
				const extraDetails = [
					applicationData.budget ? renderField('Budget', `${applicationData.budget} ${applicationData.budgetType || ''}`) : '',
					applicationData.timeline ? renderField('Timeline', applicationData.timeline) : '',
					applicationData.requirements ? `<h3 style="color: #111827; margin: 0 0 10px; font-size: 16px;">Requirements</h3><p style="margin: 0 0 10px; color: #374151;">${applicationData.requirements}</p>` : '',
					applicationData.communication ? `<h3 style="color: #111827; margin: 0 0 10px; font-size: 16px;">Communication Preferences</h3><p style="margin: 0 0 10px; color: #374151;">${applicationData.communication}</p>` : ''
				].filter(Boolean).join('');
				html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>${subject}</title>
				</head>
				<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
					<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
						<tr>
							<td>
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
									<tr>
										<td style="background: linear-gradient(to right, #00ff5e, #00e676); padding: 40px 40px; text-align: center;">
											<img src="https://ourlime.com/images/transparentLogo.png" alt="Ourlime Logo" width="150" style="margin-bottom: 20px;" />
											<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${subject}</h1>
										</td>
									</tr>
									<tr>
										<td style="padding: 40px;">
											${applicantDetails}
											${applicationData.coverLetter ? `<div style="margin-bottom: 30px;"><h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Project Description</h3><p style="margin: 0; color: #374151; line-height: 1.6;">${applicationData.coverLetter}</p></div>` : ''}
											${extraDetails}
										</td>
									</tr>
									<tr>
										<td style="background-color: #f3f4f6; padding: 20px 40px; text-align: center;">
											<p style="margin: 0; color: #6b7280; font-size: 14px;">This is an automated message from Ourlime Platform</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</body>
				</html>
				`;
				break;
			}
			case 'quicktasks': {
				subject = `New Quick Task Application: ${applicationData.jobTitle}`;
				const applicantDetails = `
					<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
						<h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Applicant Details</h3>
						${renderField('Name', applicationData.applicantName)}
						${renderField('Email', applicationData.applicantEmail, true)}
					</div>
				`;
				html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>${subject}</title>
				</head>
				<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
					<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
						<tr>
							<td>
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
									<tr>
										<td style="background: linear-gradient(to right, #00ff5e, #00e676); padding: 40px 40px; text-align: center;">
											<img src="https://ourlime.com/images/transparentLogo.png" alt="Ourlime Logo" width="150" style="margin-bottom: 20px;" />
											<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${subject}</h1>
										</td>
									</tr>
									<tr>
										<td style="padding: 40px;">
											<h2 style="color: #111827; margin: 0 0 20px; font-size: 20px;">Task: ${applicationData.jobTitle || ''}</h2>
											${applicantDetails}
											${applicationData.coverLetter ? `<div style="margin-bottom: 30px;"><h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Message</h3><p style="margin: 0; color: #374151; line-height: 1.6;">${applicationData.coverLetter}</p></div>` : ''}
											${renderScreeningSection(applicationData.answers)}
										</td>
									</tr>
									<tr>
										<td style="background-color: #f3f4f6; padding: 20px 40px; text-align: center;">
											<p style="margin: 0; color: #6b7280; font-size: 14px;">This is an automated message from Ourlime Platform</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</body>
				</html>
				`;
				break;
			}
			default: {
				subject = `New Job Application: ${applicationData.jobTitle || ''}`;
				const applicantDetails = `
					<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
						<h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Applicant Details</h3>
						${renderField('Name', applicationData.applicantName)}
						${renderField('Email', applicationData.applicantEmail, true)}
					</div>
				`;
				html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>${subject}</title>
				</head>
				<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
					<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
						<tr>
							<td>
								<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
									<tr>
										<td style="background: linear-gradient(to right, #00ff5e, #00e676); padding: 40px 40px; text-align: center;">
											<img src="https://ourlime.com/images/transparentLogo.png" alt="Ourlime Logo" width="150" style="margin-bottom: 20px;" />
											<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${subject}</h1>
										</td>
									</tr>
									<tr>
										<td style="padding: 40px;">
											<h2 style="color: #111827; margin: 0 0 20px; font-size: 20px;">Position: ${applicationData.jobTitle || ''}</h2>
											${applicantDetails}
											${applicationData.coverLetter ? `<div style="margin-bottom: 30px;"><h3 style="color: #111827; margin: 0 0 15px; font-size: 16px;">Message</h3><p style="margin: 0; color: #374151; line-height: 1.6;">${applicationData.coverLetter}</p></div>` : ''}
										</td>
									</tr>
									<tr>
										<td style="background-color: #f3f4f6; padding: 20px 40px; text-align: center;">
											<p style="margin: 0; color: #6b7280; font-size: 14px;">This is an automated message from Ourlime Platform</p>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</body>
				</html>
				`;
			}
		}

		const mailOptions = {
			from: from,
			to: to,
			subject,
			html,
		};

		return transporter.sendMail(mailOptions);
	}
}
