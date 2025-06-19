const stripe = Stripe("pk_live_51QyjAMFkTAUuP5b8POjVyVCKi0ry2R54UQz4nZaTyWJYSSYPdXliMTvkS256IoT0iSL323qcR90mZjfbH3PU8Wed00Bs0TS9MZ");
let elements;

document.addEventListener("DOMContentLoaded", () => {
  // Wait for preloader to finish and body to unlock
  const unlockCheckInterval = setInterval(() => {
    if (document.body.classList.contains("unlocked")) {
      clearInterval(unlockCheckInterval);
      initStripeCheckout();
    }
  }, 50);
});
console.log("Stripe initialized with package:", packageValue);
async function initStripeCheckout() {
  const params = new URLSearchParams(window.location.search);
  const packageValue = params.get("package");

  if (!packageValue) {
    document.querySelector("#error-message").textContent = "No package selected.";
    return;
  }
  
  // Create elements with blank billing fields so Stripe will show them
  elements = stripe.elements({
    clientSecret: "", // placeholder until we fetch it
    defaultValues: {
      billingDetails: {
        name: '',
        email: ''
      }
    }
  });

  try {
    const response = await fetch("/.netlify/functions/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: packageValue }),
    });

    const { clientSecret } = await response.json();
    
    // Reinitialize with real clientSecret
    elements = stripe.elements({
      clientSecret,
      defaultValues: {
        billingDetails: {
          name: '',
          email: ''
        }
      }
    });

    const paymentElement = elements.create("payment");
    paymentElement.mount("#payment-element");

    const form = document.querySelector("#payment-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      document.querySelector("#submit").disabled = true;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: "https://packages.rmtutoringservices.com/pages/success",
        },
      });

      if (error) {
        document.querySelector("#error-message").textContent = error.message;
        document.querySelector("#submit").disabled = false;
      }
    });

  } catch (err) {
    document.querySelector("#error-message").textContent = `Error: ${err.message}`;
  }
}
