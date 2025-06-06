let stripe, elements;
let selectedPackage = '4hr';

document.addEventListener("DOMContentLoaded", async () => {
  const packageSelector = document.getElementById("package");

  async function initializePaymentForm(pkg) {
    const res = await fetch("/.netlify/functions/create-payment-intent", {
      method: "POST",
      body: JSON.stringify({ package: pkg }),
    });

    const { clientSecret, publishableKey } = await res.json();

    stripe = Stripe(publishableKey);
    elements = stripe.elements({ clientSecret });

    const paymentElement = elements.create("payment");
    document.getElementById("payment-element").innerHTML = ""; // clear previous
    paymentElement.mount("#payment-element");
  }

  await initializePaymentForm(selectedPackage);

  packageSelector.addEventListener("change", async (e) => {
    selectedPackage = e.target.value;
    await initializePaymentForm(selectedPackage);
  });

  document.getElementById("payment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: "https://packages.rmtutoringservices.com/success",
      },
    });

    if (error) {
      document.getElementById("error-message").textContent = error.message;
    }
  });
});
