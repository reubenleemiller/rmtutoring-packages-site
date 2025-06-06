const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  "4hr": 16000,
  "8hr": 32000,
  "12hr": 48000,
};

exports.handler = async (event) => {
  const { package } = JSON.parse(event.body);

  const amount = PRICES[package];

  if (!amount) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid package selected" }),
    };
  }

  try {
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
