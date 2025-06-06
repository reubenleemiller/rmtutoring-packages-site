// scripts/client.js

const stripe = Stripe("pk_live_51QyjAMFkTAUuP5b8POjVyVCKi0ry2R54UQz4nZaTyWJYSSYPdXliMTvkS256IoT0iSL323qcR90mZjfbH3PU8Wed00Bs0TS9MZ"); // Replace with your real publishable key

let elements;

document.addEventListener("DOMContentLoaded", () => {
  initialize();

  const form = document.querySelector("#payment-form");
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }
});

async function initialize() {
  const packageValue = document.querySelector("#package").value;

  try {
    const response = await fetch("/.netlify/functions/create-payment-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ package: packageValue }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const { clientSecret } = await response.json();

    elements = stripe.elements({ clientSecret });

    const paymentElement = elements.create("payment");
    paymentElement.mount("#payment-element");
  } catch (error) {
    document.querySelector("#error-message").textContent = `Failed to initialize payment: ${error.message}`;
    console.error("Initialization error:", error);
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  document.querySelector("#submit").disabled = true;

  try {
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: "https://packages.rmtutoringservices.com/pages/success",
      },
    });

    if (error) {
      document.querySelector("#error-message").textContent = error.message;
      document.querySelector("#submit").disabled = false;
    }
  } catch (err) {
    document.querySelector("#error-message").textContent = `Unexpected error: ${err.message}`;
    console.error("Submission error:", err);
    document.querySelector("#submit").disabled = false;
  }
}
