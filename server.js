require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const morgan = require("morgan");
const { body, validationResult } = require("express-validator");
const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
require("isomorphic-fetch");

const app = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
        next();
    } else {
        res.redirect("https://" + req.headers.host + req.url);
    }
});

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
    csrf({
        cookie: {
            secure: true,
            httpOnly: true,
            sameSite: "strict",
        },
    })
);

app.use(morgan("combined"));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

const contactEmail = process.env.EMAIL;
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !contactEmail) {
    console.error("Missing required environment variables.");
    process.exit(1);
}

const credential = new ClientSecretCredential(
    TENANT_ID,
    CLIENT_ID,
    CLIENT_SECRET
);
const graphClient = Client.initWithMiddleware({
    authProvider: {
        getAccessToken: async () => {
            const token = await credential.getToken(
                "https://graph.microsoft.com/.default"
            );
            return token.token;
        },
    },
});

const commonValidationRules = [
    body("full-name")
        .trim()
        .escape()
        .notEmpty()
        .withMessage("Name is required")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("Name must contain only letters and spaces"),
    body("phone-number")
        .trim()
        .escape()
        .isMobilePhone()
        .withMessage("Valid phone number is required"),
    body("email-address")
        .isEmail()
        .normalizeEmail()
        .withMessage("Valid email is required"),
];

app.get("/csrf-token", (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.post(
    "/submit-form",
    [
        ...commonValidationRules,
        body("subject")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Subject is required"),
        body("message")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Message is required"),
    ],
    async (req, res, next) => {
        try {
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

            await sendGraphEmail({
                subject: `Form Submission: ${subject}`,
                toEmail: contactEmail,
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
            next(error);
        }
    }
);

app.post(
    "/work-application",
    [
        ...commonValidationRules,
        body("right-to-work")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Right to work is required"),
    ],
    async (req, res, next) => {
        try {
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

            await sendGraphEmail({
                subject: `Work Application: ${name}`,
                toEmail: contactEmail,
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
            next(error);
        }
    }
);

async function sendGraphEmail({ subject, toEmail, body }) {
    try {
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

        await graphClient
            .api(`/users/${encodeURIComponent(contactEmail)}/sendMail`)
            .post(email);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).send("Internal Server Error");
});

app.listen(port, () => {
    console.log(`Server listening at https://localhost:${port}`);
});
