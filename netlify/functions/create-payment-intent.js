const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  "4hr": 21599,
  "8hr": 40799,
  "12hr": 57599,
};

exports.handler = async (event) => {
  try {
    const { package: selectedPackage, coupon: couponCode } = JSON.parse(event.body || "{}");
    const baseAmount = PRICES[selectedPackage];

    if (!baseAmount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid package selected." }),
      };
    }

    let finalAmount = baseAmount;
    let appliedPromoId = null;
    let discountAmount = 0;

    if (couponCode) {
      const promoList = await stripe.promotionCodes.list({
        code: couponCode.trim(),
        active: true,
        limit: 1,
      });

      const promo = promoList.data[0];
      if (!promo) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid or expired coupon code." }),
        };
      }

      // Retrieve live coupon data
      const coupon = await stripe.coupons.retrieve(promo.coupon.id);

      // Manual redemption tracking via metadata
      const manualRedemptions = parseInt(promo.metadata.manual_redemptions || "0", 10);
      const maxRedemptions = promo.max_redemptions;

      if (maxRedemptions && manualRedemptions >= maxRedemptions) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "This coupon has already been used." }),
        };
      }

      appliedPromoId = promo.id;

      // Calculate discount
      if (coupon.amount_off) {
        discountAmount = coupon.amount_off;
      } else if (coupon.percent_off) {
        discountAmount = Math.round(baseAmount * (coupon.percent_off / 100));
      }

      finalAmount = baseAmount - discountAmount;

      if (finalAmount < 50) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Discount too large for selected package." }),
        };
      }

      // Increment redemption and optionally deactivate if limit reached
      const newRedemptions = manualRedemptions + 1;
      const shouldDeactivate = maxRedemptions && newRedemptions >= maxRedemptions;
      await stripe.promotionCodes.update(promo.id, {
        metadata: {
          ...promo.metadata,
          manual_redemptions: newRedemptions.toString(),
        },
        active: shouldDeactivate ? false : true,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "cad",
      automatic_payment_methods: { enabled: true },
      metadata: {
        package_selected: selectedPackage,
        base_amount: baseAmount,
        final_amount: finalAmount,
        discount_applied: discountAmount,
        promo_code_input: couponCode || "none",
        applied_promo_id: appliedPromoId || "none",
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        finalAmount,
        discountAmount,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};