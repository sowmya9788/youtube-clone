import "dotenv/config";
import nodemailer from "nodemailer";

/* ------------------------------------------------------------------
   1. Indian Standard Time (IST) Theme Calculator
   - 10:00 AM to 12:00 PM IST (10:00:00 to 11:59:59) -> "light"
   - All other times -> "dark"
------------------------------------------------------------------ */
export const calculateISTTheme = () => {
  const now = new Date();
  // Format to Asia/Kolkata
  const istDateString = now.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "numeric",
    minute: "numeric",
  });

  // Extract hour
  const [hourStr] = istDateString.split(":");
  const istHour = parseInt(hourStr, 10);

  if (istHour >= 10 && istHour < 12) {
    return "light";
  }
  return "dark";
};

/* ------------------------------------------------------------------
   2. User-Agent Parser for Device and Browser Details
------------------------------------------------------------------ */
export const parseUserAgent = (uaString = "") => {
  const ua = uaString.toLowerCase();

  let browser = "Unknown Browser";
  if (ua.includes("edg/")) {
    browser = "Microsoft Edge";
  } else if (ua.includes("chrome/") && !ua.includes("chromium/")) {
    browser = "Google Chrome";
  } else if (ua.includes("firefox/")) {
    browser = "Mozilla Firefox";
  } else if (ua.includes("safari/") && !ua.includes("chrome/")) {
    browser = "Apple Safari";
  } else if (ua.includes("opr/") || ua.includes("opera/")) {
    browser = "Opera";
  }

  let os = "Unknown OS";
  if (ua.includes("windows nt 10.0")) {
    os = "Windows 10/11";
  } else if (ua.includes("windows nt")) {
    os = "Windows";
  } else if (ua.includes("macintosh") || ua.includes("mac os x")) {
    os = "macOS";
  } else if (ua.includes("android")) {
    os = "Android";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  return {
    browser,
    os,
    deviceName: `${browser} on ${os}`,
  };
};

/* ------------------------------------------------------------------
   3. IP Geolocation Lookup
   - Detects City, State, Country from client IP.
   - Handles local/private IPs gracefully.
------------------------------------------------------------------ */
export const getLocationFromIp = async (rawIp = "") => {
  let ip = rawIp;

  // Clean IPv6 prefix if present
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  const isLocal =
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.");

  if (isLocal) {
    // Attempt to lookup public IP for realistic location testing in local dev
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("http://ip-api.com/json/?fields=status,country,regionName,city,query", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.status === "success") {
        return {
          city: data.city || "Local Dev",
          state: data.regionName || "Localhost",
          country: data.country || "India",
          ip: data.query || "127.0.0.1",
        };
      }
    } catch (e) {
      // Fallback
    }

    return {
      city: "Local Dev",
      state: "Localhost",
      country: "India",
      ip: "127.0.0.1",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,query`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (data.status === "success") {
      return {
        city: data.city || "Unknown City",
        state: data.regionName || "Unknown State",
        country: data.country || "India",
        ip: data.query || ip,
      };
    }
  } catch (error) {
    console.error("IP Geolocation lookup error:", error.message);
  }

  return {
    city: "Unknown City",
    state: "Unknown State",
    country: "India",
    ip: ip || "127.0.0.1",
  };
};

/* ------------------------------------------------------------------
   4. Nodemailer Transporter & OTP Email Sender
------------------------------------------------------------------ */
const getMailTransporter = () => {
  const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : "";
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : "";

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
};

export const sendSecurityOtpEmail = async ({
  toEmail,
  userName,
  otpCode,
  deviceInfo,
  locationInfo,
}) => {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #dc2626; padding: 20px 28px;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">🛡️ YourTube Login Verification</h2>
      </div>
      <div style="padding: 28px;">
        <p style="margin: 0 0 12px; font-size: 15px;">Hello <strong>${userName || toEmail}</strong>,</p>
        <p style="margin: 0 0 16px; color: #4b5563; font-size: 14px; line-height: 1.5;">
          A login attempt was detected from a <strong>new device or location</strong>. To complete your sign-in, please enter the one-time verification code below:
        </p>

        <div style="text-align: center; margin: 24px 0; padding: 18px; background: #f3f4f6; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">
            ${otpCode}
          </span>
          <p style="margin: 8px 0 0; color: #6b7280; font-size: 12px;">This code will expire in <strong>10 minutes</strong>.</p>
        </div>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #374151;">
          <p style="margin: 0 0 6px; font-weight: 600; color: #111827;">📍 Login Details:</p>
          <p style="margin: 2px 0;"><strong>Device:</strong> ${deviceInfo.deviceName || "Web Browser"}</p>
          <p style="margin: 2px 0;"><strong>Location:</strong> ${locationInfo.city}, ${locationInfo.state}, ${locationInfo.country}</p>
          <p style="margin: 2px 0;"><strong>Time (IST):</strong> ${istTime}</p>
          <p style="margin: 2px 0;"><strong>IP Address:</strong> ${locationInfo.ip || "Unknown"}</p>
        </div>

        <p style="margin: 0; color: #ef4444; font-size: 12px; line-height: 1.4;">
          ⚠️ If you did not attempt to sign in, someone else may be trying to access your account. Please secure your Google account immediately.
        </p>
      </div>
      <div style="background: #f3f4f6; padding: 12px 28px; text-align: center; font-size: 12px; color: #9ca3af;">
        YourTube Security Team
      </div>
    </div>
  `;

  const senderUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : "";
  const senderPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : "";

  console.log(`[OTP] Generated 6-digit OTP code for user: ${toEmail}`);

  if (senderUser && senderPass && !senderPass.includes("XXXX")) {
    console.log(`[OTP Email] Attempting to send OTP email from ${senderUser} to ${toEmail}...`);
    try {
      const transporter = getMailTransporter();
      const info = await transporter.sendMail({
        from: `"YourTube Security" <${senderUser}>`,
        to: toEmail,
        subject: `🔐 YourTube Security Code: ${otpCode} (New Login Detected)`,
        html,
      });

      console.log(`[OTP Email SUCCESS] Security OTP email successfully delivered to ${toEmail} | Message ID: ${info.messageId}`);
    } catch (err) {
      console.error(`[OTP Email FAILED] Nodemailer error sending to ${toEmail}:`, err.message);
      console.error(`[OTP Email Error Details]:`, {
        code: err.code,
        responseCode: err.responseCode,
        response: err.response,
        command: err.command,
      });
      console.log(`[Security Console Fallback] OTP code for ${toEmail}: ${otpCode}`);
    }
  } else {
    // If SMTP credentials not provided, print OTP to server console
    console.log(`\n========================================`);
    console.log(`🛡️ [SECURITY OTP] New login for ${toEmail}`);
    console.log(`🔑 OTP CODE: ${otpCode}`);
    console.log(`📍 Location: ${locationInfo.city}, ${locationInfo.state}`);
    console.log(`💻 Device:   ${deviceInfo.deviceName}`);
    console.log(`========================================\n`);
  }
};
