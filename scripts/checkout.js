const stripe = Stripe("pk_test_51QyjAMFkTAUuP5b82jYSwMC96AclTfz6Ey02T8nWYXILZrLf1TeWosP42yPAh5tIvcvmadj2bN6T4JwNYiFK1WfS00DmubNBSn"); // Use test key for dev
let elements;
let clientSecret;

document.addEventListener("DOMContentLoaded", () => {
  const unlockCheckInterval = setInterval(() => {
    if (document.body.classList.contains("unlocked")) {
      clearInterval(unlockCheckInterval);
      initStripeCheckout();
    }
  }, 50);
});

async function initStripeCheckout() {
  const params = new URLSearchParams(window.location.search);
  const packageValue = params.get("package");

  if (!packageValue) {
    document.querySelector("#error-message").textContent = "No package selected.";
    return;
  }

  // ✅ Wait until user enters email & name, then submit
  const form = document.querySelector("#payment-form");

  // ✅ Submit handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    document.querySelector("#submit").disabled = true;

    const firstName = document.getElementById("first-name")?.value.trim() || "";
    const lastName = document.getElementById("last-name")?.value.trim() || "";
    const customerEmail = document.getElementById("email")?.value.trim() || "";
    const customerName = `${firstName} ${lastName}`.trim();

    try {
      // ✅ Only create PaymentIntent once
      if (!clientSecret) {
        const response = await fetch("/.netlify/functions/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            package: packageValue,
            customerEmail,
            customerName
          })
        });

        const json = await response.json();
        clientSecret = json.clientSecret;

        if (!clientSecret || !clientSecret.startsWith("pi_")) {
          throw new Error("Invalid clientSecret returned from server.");
        }

        // ✅ Mount only once after receiving clientSecret
        elements = stripe.elements({
          clientSecret,
          defaultValues: {
            billingDetails: {
              name: customerName,
              email: customerEmail
            }
          }
        });

        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");

        // ⚠️ Stop here and let user enter card info
        document.querySelector("#submit").disabled = false;
        return;
      }

      // ✅ Now confirm payment
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: "https://packages.rmtutoringservices.com/pages/success",
        }
      });

      if (error) {
        document.querySelector("#error-message").textContent = error.message;
        document.querySelector("#submit").disabled = false;
      }

    } catch (err) {
      console.error(err);
      document.querySelector("#error-message").textContent = `Error: ${err.message}`;
      document.querySelector("#submit").disabled = false;
    }
  });
}
