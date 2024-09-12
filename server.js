require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const app = express();
const port = process.env.PORT || 3000;

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
        const contactEmail = "contact@grants4you.org";

        let transporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            port: 465,
            secure: true,
            auth: {
                user: contactEmail,
                pass: process.env.PASSWORD,
            },
        });

        let mailOptions = {
            from: contactEmail,
            to: contactEmail,
            subject: `Form Submission: ${subject}`,
            html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #007bff;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff;">${email}</a></p>
        <p><strong>Message:</strong> ${message}</p>
      </div>`,
        };

        try {
            await transporter.sendMail(mailOptions);
            res.redirect("/thank-you-for-getting-in-touch-with-us.html");
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
        const contactEmail = "contact@grants4you.org";

        let transporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            port: 465,
            secure: true,
            auth: {
                user: contactEmail,
                pass: process.env.PASSWORD,
            },
        });

        let mailOptions = {
            from: contactEmail,
            to: contactEmail,
            subject: `Work Application: ${name}`,
            html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #007bff;">New Work Application</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff;">${email}</a></p>
          <p><strong>Right to Work:</strong> ${right}</p>
        </div>`,
        };

        try {
            await transporter.sendMail(mailOptions);
            res.redirect("/thank-you-for-applying.html");
        } catch (error) {
            console.error("Failed to send email:", error);
            return res.status(500).send("Error submitting form");
        }
    }
);

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
