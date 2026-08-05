(function () {
      const toggle = document.querySelector('.nav-toggle');
      const nav = document.querySelector('#main-nav');
      if (toggle && nav) {
        toggle.addEventListener('click', function () {
          const open = nav.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(open));
          toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        });
        nav.querySelectorAll('a').forEach(function (link) {
          link.addEventListener('click', function () {
            nav.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open navigation');
          });
        });
      }

      const year = document.querySelector('#year');
      if (year) year.textContent = new Date().getFullYear();

      const form = document.querySelector('#lead-form');
      const success = document.querySelector('#form-success');
      if (form && success) {
        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          const endpoint = form.dataset.endpoint;
          const submit = form.querySelector('button[type="submit"]');
          submit.disabled = true;
          submit.innerHTML = 'Sending…';
          try {
            if (endpoint) {
              const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
              if (!response.ok) throw new Error('Unable to send');
            }
            success.classList.add('show');
            form.reset();
            success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } catch (error) {
            success.textContent = 'The form endpoint is not connected yet. Please add your email/CRM endpoint before launch.';
            success.classList.add('show');
          } finally {
            submit.disabled = false;
            submit.innerHTML = 'Request my audit <span class="arrow">↗</span>';
          }
        });
      }

      const revealItems = document.querySelectorAll('.reveal');
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });
        revealItems.forEach(function (item) { observer.observe(item); });
      } else {
        revealItems.forEach(function (item) { item.classList.add('visible'); });
      }
    }());
