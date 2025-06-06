const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PACKAGE_PRICES = {
  '4hr': 16000,  // $160
  '8hr': 32000,  // $320
  '12hr': 48000  // $480
};

exports.handler = async (event) => {
  try {
    const { package: selectedPackage } = JSON.parse(event.body || "{}");

    const amount = PACKAGE_PRICES[selectedPackage] || PACKAGE_PRICES['4hr'];

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'cad',
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
