const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  "4hr": "price_1RWsHNFkTAUuP5b8o8vv8tBP",    // Replace with your real Stripe Price IDs
  "8hr": "price_8HOUR",
  "12hr": "price_12HOUR"
};

exports.handler = async (event) => {
  const { package } = JSON.parse(event.body);
  const priceId = PRICES[package];

  if (!priceId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid package selected" }),
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: {
        "4hr": 16000,
        "8hr": 32000,
        "12hr": 48000
      }[package],
      currency: "cad",
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
