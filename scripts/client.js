// scripts/client.js

// Replace with your real Stripe publishable key
const stripe = Stripe("pk_live_51QyjAMFkTAUuP5b8POjVyVCKi0ry2R54UQz4nZaTyWJYSSYPdXliMTvkS256IoT0iSL323qcR90mZjfbH3PU8Wed00Bs0TS9MZ");

let elements;

document.addEventListener("DOMContentLoaded", () => {
  initialize();

  const form = document.querySelector("#payment-form");
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  const packageSelector = document.querySelector("#package");
  if (packageSelector) {
    packageSelector.addEventListener("change", initialize);
  }
});

async function initialize() {
  const packageValue = document.querySelector("#package").value;

  const response = await fetch("/.netlify/functions/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package: packageValue }),
  });

  if (!response.ok) {
    const { error } = await response.json();
    document.querySelector("#error-message").textContent = error || "Failed to load payment info.";
    return;
  }

  const { clientSecret } = await response.json();

  if (!clientSecret) {
    document.querySelector("#error-message").textContent = "Missing client secret.";
    return;
  }

  elements = stripe.elements({ clientSecret });

  const paymentElement = elements.create("payment");
  paymentElement.mount("#payment-element");
}

async function handleSubmit(e) {
  e.preventDefault();
  document.querySelector("#submit").disabled = true;

  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: "https://packages.rmtutoringservices.com/success",
    },
  });

  if (error) {
    document.querySelector("#error-message").textContent = error.message;
    document.querySelector("#submit").disabled = false;
  }
}
