require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
require("isomorphic-fetch");

const app = express();
const port = process.env.PORT || 3020;

app.set("trust proxy", true);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});

app.use("/submit-form", limiter);

app.post(
    "/submit-form",
    [
        body("full-name").trim().escape(),
        body("phone-number").trim().isMobilePhone().escape(),
        body("email-address").isEmail().normalizeEmail(),
        body("subject").trim().escape(),
        body("message").trim().escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            "full-name": name,
            "phone-number": phone,
            "email-address": email,
            subject,
            message,
        } = req.body;

        try {
            await sendGraphEmail({
                subject: `Form Submission: ${subject}`,
                toEmail: process.env.EMAIL,
                body: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #007bff;">New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff;">${email}</a></p>
                    <p><strong>Message:</strong> ${message}</p>
                </div>`,
            });
            res.redirect(
                "https://grants4you.org/thank-you-for-getting-in-touch-with-us.html"
            );
        } catch (error) {
            console.error("Failed to send email:", error);
            return res.status(500).send("Error submitting form");
        }
    }
);

app.post(
    "/work-application",
    [
        body("full-name").trim().escape(),
        body("phone-number").trim().isMobilePhone().escape(),
        body("email-address").isEmail().normalizeEmail(),
        body("right-to-work").trim().escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            "full-name": name,
            "phone-number": phone,
            "email-address": email,
            "right-to-work": right,
        } = req.body;

        try {
            await sendGraphEmail({
                subject: `Work Application: ${name}`,
                toEmail: process.env.EMAIL,
                body: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #007bff;">New Work Application</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff;">${email}</a></p>
                    <p><strong>Right to Work:</strong> ${right}</p>
                </div>`,
            });
            res.redirect("https://grants4you.org/thank-you-for-applying.html");
        } catch (error) {
            console.error("Failed to send email:", error);
            return res.status(500).send("Error submitting form");
        }
    }
);

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

async function sendGraphEmail({ subject, toEmail, body }) {
    const credential = new ClientSecretCredential(
        process.env.TENANT_ID,
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET
    );

    const client = Client.initWithMiddleware({
        authProvider: {
            getAccessToken: async () => {
                const token = await credential.getToken(
                    "https://graph.microsoft.com/.default"
                );
                return token.token;
            },
        },
    });

    const email = {
        message: {
            subject: subject,
            body: {
                contentType: "HTML",
                content: body,
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: toEmail,
                    },
                },
            ],
        },
    };

    await client
        .api("/users/" + process.env.EMAIL + "/sendMail")
        .post({ message: email.message });
}
