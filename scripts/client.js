const stripe = Stripe("pk_live_51QyjAMFkTAUuP5b8POjVyVCKi0ry2R54UQz4nZaTyWJYSSYPdXliMTvkS256IoT0iSL323qcR90mZjfbH3PU8Wed00Bs0TS9MZ");

const subscriptionLinks = {
  "4hr": "https://pay.rmtutoringservices.com/b/14AcN5fmd2pzaX0gOn9sk03",
  "8hr": "https://pay.rmtutoringservices.com/b/3cI5kD6PH5BLaX0gOn9sk04",
  "12hr": "https://pay.rmtutoringservices.com/b/bJeaEX6PH7JT2queGf9sk05"
};

let selectedPackage = "8hr";
let currentIndex = 1;

document.addEventListener("DOMContentLoaded", () => {
  const pricingCards = document.querySelectorAll(".pricing-card");
  const submitButton = document.querySelector("#submit");
  const dotContainer = document.querySelector("#carousel-dots");
  const leftArrow = document.querySelector(".carousel-arrow.left");
  const rightArrow = document.querySelector(".carousel-arrow.right");
  const carousel = document.querySelector(".pricing-carousel");

  function updateActiveDot(index) {
    document.querySelectorAll(".carousel-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  function createDots() {
    dotContainer.innerHTML = "";
    pricingCards.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.classList.add("carousel-dot");
      if (i === currentIndex) dot.classList.add("active");
      dotContainer.appendChild(dot);
    });
  }

  function scrollToCard(index, smooth = true) {
    const card = pricingCards[index];
    if (!card || !carousel) return;

    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const carouselCenter = carousel.offsetWidth / 2;
    const scrollLeft = cardCenter - carouselCenter;

    carousel.scrollTo({
      left: scrollLeft,
      behavior: smooth ? "smooth" : "auto"
    });

    updateActiveDot(index);
    currentIndex = index;
  }

  function selectCard(index) {
    pricingCards.forEach((card, i) => {
      card.classList.toggle("selected", i === index);
      const checkbox = card.querySelector("input[type='checkbox']");
      if (checkbox && i !== index) checkbox.checked = false;
    });

    selectedPackage = pricingCards[index].dataset.package;
    scrollToCard(index);
  }

  pricingCards.forEach((card, index) => {
    const selectBtn = card.querySelector(".select-btn");
    if (selectBtn) {
      selectBtn.addEventListener("click", () => {
        selectCard(index);
      });
    }
  });

  if (leftArrow && rightArrow) {
    leftArrow.addEventListener("click", () => {
      if (currentIndex > 0) {
        selectCard(currentIndex - 1);
      }
    });

    rightArrow.addEventListener("click", () => {
      if (currentIndex < pricingCards.length - 1) {
        selectCard(currentIndex + 1);
      }
    });
  }

  if (carousel) {
    carousel.addEventListener("scroll", () => {
      const center = carousel.scrollLeft + carousel.offsetWidth / 2;
      let closest = 0;
      let minDiff = Infinity;

      pricingCards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const diff = Math.abs(center - cardCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      });

      currentIndex = closest;
      updateActiveDot(currentIndex);
    });

    // Final guaranteed scroll on full page + layout render
    function waitForPreloaderThenScroll() {
  const selectedCard = document.querySelector(".pricing-card.selected");
  const carousel = document.querySelector(".pricing-carousel");

  if (!selectedCard || !carousel) return;

  const cardCenter = selectedCard.offsetLeft + selectedCard.offsetWidth / 2;
  const carouselCenter = carousel.offsetWidth / 2;
  const scrollLeft = cardCenter - carouselCenter;

  // Only scroll once the layout is stable and the preloader is gone
  if (document.documentElement.classList.contains('preloader-lock') || carousel.offsetWidth === 0) {
    requestAnimationFrame(waitForPreloaderThenScroll);
  } else {
    carousel.scrollLeft = scrollLeft;
  }
}

window.addEventListener("load", () => {
  requestAnimationFrame(waitForPreloaderThenScroll);
});
  }

  createDots();

  if (submitButton) {
    submitButton.addEventListener("click", async e => {
      e.preventDefault();
      submitButton.disabled = true;

      const selectedCard = document.querySelector(".pricing-card.selected");
      const subscribe = selectedCard?.querySelector("input[type='checkbox']")?.checked;
      const pkg = selectedCard?.dataset.package;

      if (!pkg) {
        document.querySelector("#error-message").textContent = "Please select a package.";
        submitButton.disabled = false;
        return;
      }

      if (subscribe && subscriptionLinks[pkg]) {
        window.location.href = subscriptionLinks[pkg];
      } else {
        window.location.href = `https://packages.rmtutoringservices.com/pages/checkout.html?package=${pkg}`;
      }
    });
  }
});
