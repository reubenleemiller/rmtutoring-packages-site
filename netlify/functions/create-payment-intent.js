const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { package } = JSON.parse(event.body);

    // Log inputs and environment (optional for debugging)
    console.log("Selected package:", package);
    console.log("Using Stripe Key Prefix:", process.env.STRIPE_SECRET_KEY?.slice(0, 8));

    const PACKAGE_AMOUNTS = {
      "4hr": 16000,   // in cents = $160.00 CAD
      "8hr": 32000,
      "12hr": 48000,
    };

    const amount = PACKAGE_AMOUNTS[package];

    if (!amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid package selected" }),
      };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "cad",
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    console.error("Stripe Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
