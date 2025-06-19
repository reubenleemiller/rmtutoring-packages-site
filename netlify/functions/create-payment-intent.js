const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  "4hr": 16000,
  "8hr": 32000,
  "12hr": 48000,
};

exports.handler = async (event) => {
  try {
    const { package: selectedPackage } = JSON.parse(event.body || "{}");
    const amount = PRICES[selectedPackage];

    if (!amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid package selected." }),
      };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "cad",
      automatic_payment_methods: { enabled: true },
      metadata: { package_selected: selectedPackage },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
