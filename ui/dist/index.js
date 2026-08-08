(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", function () {
    initFooterYear();
    initMobileMenu();
    initMobileAccordion();
    initNavShadow();
    initFaqAccordion();
    initNewsletterForm();
    initContactForm();

    if (window.gsap) {
      initHeroFlow();
      initScrollReveal();
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
  // Contact form — front-end only feedback for now
  // ---------------------------------------------------------------------
  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var button = form.querySelector("button[type=submit]");
      if (!button) return;

      var originalHTML = button.innerHTML;
      button.textContent = "Message sent";
      button.disabled = true;

      setTimeout(function () {
        button.innerHTML = originalHTML;
        button.disabled = false;
        form.reset();
      }, 2600);
    });
  }

  // ---------------------------------------------------------------------
  // Hero ambient flow field — droplet/flow motif from the brand mark
  // ---------------------------------------------------------------------
  function initHeroFlow() {
    if (reduceMotion) return;

    gsap.to("#flow-blob-1", {
      x: 40,
      y: 30,
      duration: 9,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
    gsap.to("#flow-blob-2", {
      x: -30,
      y: -20,
      duration: 11,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    var paths = gsap.utils.toArray(".flow-path");
    paths.forEach(function (path, i) {
      var length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 2.4,
        delay: 0.3 + i * 0.25,
        ease: "power2.out",
      });
      gsap.to(path, {
        y: i % 2 === 0 ? 14 : -14,
        duration: 6 + i,
        delay: 2.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    });

    gsap.from("#hero-field", { opacity: 0, duration: 1.6, ease: "power1.out" });
  }

  // ---------------------------------------------------------------------
  // Scroll reveal — [data-reveal] elements fade/rise into view once
  // ---------------------------------------------------------------------
  function initScrollReveal() {
    gsap.registerPlugin(ScrollTrigger);

    var targets = gsap.utils.toArray("[data-reveal]");
    targets.forEach(function (el, i) {
      if (reduceMotion) {
        gsap.set(el, { opacity: 1, y: 0 });
        return;
      }
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
        }
      );
    });
  }
})();
