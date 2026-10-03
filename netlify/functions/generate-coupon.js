const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const { firstName, lastName, email, numStudents } = JSON.parse(event.body || "{}");

    if (!firstName || !lastName || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const redemptions = Math.max(1, Math.min(parseInt(numStudents || 1), 10)); // limit 1–10

    // Create the coupon (5% off) with a name for admin visibility
    const coupon = await stripe.coupons.create({
      percent_off: 5,
      duration: "once",
      name: `${firstName}-${lastName} 5% Off Coupon`
    });

    // Generate a code like RM-7GHSKZ
    const initials = (firstName[0] + lastName[0]).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const promoCodeStr = `${initials}-${randomSuffix}`;

    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: promoCodeStr,
      max_redemptions: redemptions
    });

    // Send RESEND email prompting booking
    await resend.emails.send({
      from: "RM Tutoring Services <info@rmtutoringservices.com>",
      to: email,
      subject: "Discount Requested: Book Your Meet & Greet to Proceed",
      html: `
        <p>Hi ${firstName},</p>
        <p>Thanks for your interest in RM Tutoring Services!</p>
        <p>To access your personalized discount, please book a free Meet & Greet session here so we can further assess your current situation:</p>
        <p><a href="https://scheduling.rmtutoringservices.com/rleemiller/15min" target="_blank"><strong>Click Here to Book Now</strong></a></p>
        <p>Once completed, your instructor will provide your exclusive discount code.</p>
        <p>This code will be valid for up to <strong>${redemptions}</strong> student${redemptions > 1 ? "s" : ""}.</p>
        <br />
        <p> we look forward to hearing from you soon! should you have any further questions you may reply to this email</p>
        <p>
        --<br>
        <div style="color:#888;"><strong>Reuben Miller</strong></div>
        <div style="color: #888;">RM Tutoring Services</div>
        <a href="mailto:reuben.miller@rmtutoringservices.com">reuben.miller@rmtutoringservices.com</a><br>
        <a href="https://rmtutoringservices.com" target="_blank">rmtutoringservices.com</a><br>
        <img src="https://www.rmtutoringservices.com/assets/logo.png" alt="RM Tutoring Services" style="width:120px; margin-top:8px;" />
        </p>
      `
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};