// scripts/client.js

const stripe = Stripe("pk_test_51QyjAMFkTAUuP5b82jYSwMC96AclTfz6Ey02T8nWYXILZrLf1TeWosP42yPAh5tIvcvmadj2bN6T4JwNYiFK1WfS00DmubNBSn"); // Replace with your real publishable key

let elements;
initialize();

document
  .querySelector("#payment-form")
  .addEventListener("submit", handleSubmit);

async function initialize() {
  const packageValue = document.querySelector("#package").value;

  const response = await fetch("/.netlify/functions/create-payment-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ package: packageValue }),
  });

  const { clientSecret } = await response.json();

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
