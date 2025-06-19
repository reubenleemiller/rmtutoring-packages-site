const stripe = Stripe("pk_test_51QyjAMFkTAUuP5b82jYSwMC96AclTfz6Ey02T8nWYXILZrLf1TeWosP42yPAh5tIvcvmadj2bN6T4JwNYiFK1WfS00DmubNBSn");
let elements;

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

  // ✅ Get user inputs
  const firstNameInput = document.getElementById("first-name");
  const lastNameInput = document.getElementById("last-name");
  const emailInput = document.getElementById("email");

  if (!firstNameInput || !lastNameInput || !emailInput) {
    console.error("Name and email inputs are missing in the HTML.");
    return;
  }

  const customerFirstName = firstNameInput.value.trim();
  const customerLastName = lastNameInput.value.trim();
  const customerName = `${customerFirstName} ${customerLastName}`;
  const customerEmail = emailInput.value.trim();

  try {
    // ✅ Send to backend with full name and email
    const response = await fetch("/.netlify/functions/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: packageValue,
        customerEmail,
        customerName
      })
    });

    const { clientSecret } = await response.json();

    if (!clientSecret || !clientSecret.startsWith("pi_")) {
      throw new Error("Invalid clientSecret returned from server.");
    }

    // ✅ Mount Stripe Payment Element with prefilled billing details
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

    const form = document.querySelector("#payment-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      document.querySelector("#submit").disabled = true;

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
    });

  } catch (err) {
    console.error(err);
    document.querySelector("#error-message").textContent = `Error: ${err.message}`;
  }
}
