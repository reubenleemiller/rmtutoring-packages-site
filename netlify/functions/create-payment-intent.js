const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  "4hr": 16000,
  "8hr": 32000,
  "12hr": 48000
};

exports.handler = async (event) => {
  try {
    const { package: selectedPackage, customerEmail, customerName } = JSON.parse(event.body || "{}");

    const amount = PRICES[selectedPackage];

    if (!amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid package selected." }),
      };
    }

    const paymentIntentData = {
      amount,
      currency: "cad",
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_name: customerName || "Not provided",
        package_selected: selectedPackage
      }
    };

    if (customerEmail) {
      paymentIntentData.receipt_email = customerEmail;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    console.error("Error creating payment intent:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
