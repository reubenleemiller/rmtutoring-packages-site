const stripe = Stripe("pk_live_51QyjAMFkTAUuP5b8POjVyVCKi0ry2R54UQz4nZaTyWJYSSYPdXliMTvkS256IoT0iSL323qcR90mZjfbH3PU8Wed00Bs0TS9MZ");
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

  // ✅ Get user inputs for name and email
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");

  if (!nameInput || !emailInput) {
    console.error("Name and email inputs are missing in the HTML.");
    return;
  }

  const customerName = nameInput.value || "";
  const customerEmail = emailInput.value || "";

  try {
    // ✅ Fetch clientSecret from backend, sending name/email
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
