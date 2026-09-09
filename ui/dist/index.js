(function () {
  "use strict";

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  document.addEventListener("DOMContentLoaded", function () {
    initFooterYear();
    initMobileMenu();
    initMobileAccordion();
    initNavShadow();
    initFaqAccordion();
    initNewsletterForm();
    initContactForm();
    initPricingToggle();

    // GSAP/ScrollTrigger load via <script async>, independently of this
    // file, so they may already be present, still in flight, or (rare
    // async/async race) may have finished and fired gsap:ready before this
    // listener was even attached — window.__gsapReady covers that case.
    if (window.gsap && window.ScrollTrigger) {
      initScrollReveal();
    } else if (window.__gsapReady) {
      initScrollReveal();
    } else {
      window.addEventListener("gsap:ready", initScrollReveal, { once: true });
    }
  });

  // ---------------------------------------------------------------------
  // Footer year
  // ---------------------------------------------------------------------
  function initFooterYear() {
    var el = document.getElementById("footer-year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  // ---------------------------------------------------------------------
  // Mobile menu toggle
  // ---------------------------------------------------------------------
  function initMobileMenu() {
    var toggle = document.getElementById("menu-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", function () {
      var isOpen = !menu.classList.contains("hidden");
      menu.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!isOpen));
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menu.classList.add("hidden");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---------------------------------------------------------------------
  // Mobile nav accordion — Solutions / Resources expand in place instead
  // of dumping every child link into the flat list at once
  // ---------------------------------------------------------------------
  function initMobileAccordion() {
    var items = document.querySelectorAll(".mobile-accordion-item");
    items.forEach(function (item) {
      var trigger = item.querySelector(".mobile-accordion-trigger");
      var panel = item.querySelector(".mobile-accordion-panel");
      var icon = item.querySelector(".mobile-accordion-icon");
      if (!trigger || !panel) return;

      trigger.addEventListener("click", function () {
        var isOpen = panel.classList.contains("grid-rows-[1fr]");

        items.forEach(function (other) {
          var otherPanel = other.querySelector(".mobile-accordion-panel");
          var otherIcon = other.querySelector(".mobile-accordion-icon");
          otherPanel.classList.remove("grid-rows-[1fr]");
          otherPanel.classList.add("grid-rows-[0fr]");
          if (otherIcon) otherIcon.style.transform = "rotate(0deg)";
        });

        if (!isOpen) {
          panel.classList.remove("grid-rows-[0fr]");
          panel.classList.add("grid-rows-[1fr]");
          if (icon) icon.style.transform = "rotate(180deg)";
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Nav shadow on scroll
  // ---------------------------------------------------------------------
  function initNavShadow() {
    var nav = document.getElementById("site-nav");
    if (!nav) return;

    function update() {
      if (window.scrollY > 8) {
        nav.classList.add("shadow-lg", "shadow-ink/[0.06]");
      } else {
        nav.classList.remove("shadow-lg", "shadow-ink/[0.06]");
      }
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  // ---------------------------------------------------------------------
  // FAQ accordion — CSS grid-rows trick, no height math needed
  // ---------------------------------------------------------------------
  function initFaqAccordion() {
    var items = document.querySelectorAll(".faq-item");
    items.forEach(function (item) {
      var trigger = item.querySelector(".faq-trigger");
      var panel = item.querySelector(".faq-panel");
      var icon = item.querySelector(".faq-icon");
      if (!trigger || !panel) return;

      trigger.addEventListener("click", function () {
        var isOpen = panel.classList.contains("grid-rows-[1fr]");

        items.forEach(function (other) {
          var otherPanel = other.querySelector(".faq-panel");
          var otherIcon = other.querySelector(".faq-icon");
          otherPanel.classList.remove("grid-rows-[1fr]");
          otherPanel.classList.add("grid-rows-[0fr]");
          if (otherIcon) otherIcon.style.transform = "rotate(0deg)";
        });

        if (!isOpen) {
          panel.classList.remove("grid-rows-[0fr]");
          panel.classList.add("grid-rows-[1fr]");
          if (icon) icon.style.transform = "rotate(180deg)";
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Pricing monthly/yearly toggle — swaps [data-price-monthly] /
  // [data-price-yearly] spans via the hidden attribute. Every pricing card
  // on the page updates together from one toggle, driven by data-period on
  // the clicked button rather than a per-card state.
  // ---------------------------------------------------------------------
  function initPricingToggle() {
    var toggle = document.getElementById("pricing-toggle");
    if (!toggle) return;

    var buttons = toggle.querySelectorAll(".pricing-toggle-btn");
    var monthlyEls = document.querySelectorAll("[data-price-monthly]");
    var yearlyEls = document.querySelectorAll("[data-price-yearly]");

    function setPeriod(period) {
      var isYearly = period === "yearly";

      monthlyEls.forEach(function (el) {
        el.hidden = isYearly;
      });
      yearlyEls.forEach(function (el) {
        el.hidden = !isYearly;
      });

      buttons.forEach(function (btn) {
        var active = btn.getAttribute("data-period") === period;
        btn.setAttribute("aria-selected", String(active));
        btn.classList.toggle("bg-ink", active);
        btn.classList.toggle("text-white", active);
        btn.classList.toggle("text-ink/60", !active);
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPeriod(btn.getAttribute("data-period"));
      });
    });

    setPeriod("monthly");
  }

  // ---------------------------------------------------------------------
  // Newsletter form — front-end only feedback for now
  // ---------------------------------------------------------------------
  function initNewsletterForm() {
    var form = document.getElementById("newsletter-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = form.querySelector("button[type=submit]");
      var input = form.querySelector("input[type=email]");
      if (!button || !input || !input.value) return;

      var originalText = button.textContent;
      button.textContent = "You're on the list";
      button.disabled = true;
      input.disabled = true;

      setTimeout(function () {
        button.textContent = originalText;
        button.disabled = false;
        input.disabled = false;
        input.value = "";
      }, 2600);
    });
  }

  // ---------------------------------------------------------------------
  // Contact form — POSTs to the real public /queries endpoint. Same-origin
  // in prod would be simplest, but this site is served from srotaapps.com
  // while the API lives on api.srotaapps.com, so this is a genuine
  // cross-origin fetch (already allowed — UI_VIRTUAL_HOST is in the API's
  // CORS_ALLOWED_ORIGINS list, see api/core/configs.py).
  // ---------------------------------------------------------------------
  var CONTACT_API_URL =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:8006/api/queries"
      : "https://api.srotaapps.com/api/queries";

  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;

    // Inline styles, not Tailwind classes — this file isn't part of the
    // Tailwind CLI's build input (see Dockerfile: only src/*.html/blog/public
    // are copied into the build stage; dist/index.js is copied straight into
    // the runtime image), so any class referenced only here never makes it
    // into the compiled output.css.
    var status = document.createElement("p");
    status.style.marginTop = "12px";
    status.style.fontSize = "14px";
    status.setAttribute("role", "status");
    status.hidden = true;
    form.appendChild(status);

    function setStatus(message, isError) {
      status.textContent = message;
      status.style.color = isError ? "#dc2626" : "#059669";
      status.hidden = false;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var button = form.querySelector("button[type=submit]");
      if (!button) return;

      var data = new FormData(form);
      var payload = {
        name: data.get("name"),
        email: data.get("email"),
        business_name: data.get("business") || null,
        phone: data.get("phone") || null,
        app_interest: data.get("app") || null,
        message: data.get("message"),
      };

      var originalHTML = button.innerHTML;
      button.textContent = "Sending…";
      button.disabled = true;
      status.hidden = true;

      fetch(CONTACT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function (result) {
          if (result.ok && result.body.success) {
            setStatus(
              result.body.message ||
                "Thanks — we'll get back to you within a day.",
              false,
            );
            form.reset();
          } else if (
            result.body.error &&
            result.body.error.code === "HTTP_ERROR"
          ) {
            setStatus(
              "Too many messages sent — please try again in a minute.",
              true,
            );
          } else {
            setStatus(
              "Something went wrong. Please try again or email us directly.",
              true,
            );
          }
        })
        .catch(function () {
          setStatus(
            "Something went wrong. Please try again or email us directly.",
            true,
          );
        })
        .finally(function () {
          button.innerHTML = originalHTML;
          button.disabled = false;
        });
    });
  }

  // ---------------------------------------------------------------------
  // Scroll reveal — [data-reveal] elements fade/rise into view once
  // ---------------------------------------------------------------------
  function initScrollReveal() {
    if (reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    // Arms the CSS rule that hides [data-reveal] elements pre-animation.
    // Doing this here (not in the HTML/CSS unconditionally) means content
    // stays visible by default if GSAP never loads.
    document.documentElement.classList.add("gsap-reveal-ready");

    var targets = gsap.utils.toArray("[data-reveal]");
    targets.forEach(function (el, i) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay: (i % 4) * 0.06,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
          },
        },
      );
    });
  }
})();
