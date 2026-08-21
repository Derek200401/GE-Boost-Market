(() => {
  const drawer = document.querySelector("#drawer");
  const overlay = document.querySelector("#drawerOverlay");
  const openMenu = document.querySelector("#drawerToggle");
  const closeMenu = document.querySelector("#drawerClose");
  const setDrawer = (open) => {
    if (!drawer || !overlay) return;
    drawer.classList.toggle("is-open", open);
    overlay.classList.toggle("is-visible", open);
    document.body.classList.toggle("drawer-open", open);
  };
  openMenu?.addEventListener("click", () => setDrawer(true));
  closeMenu?.addEventListener("click", () => setDrawer(false));
  overlay?.addEventListener("click", () => setDrawer(false));
  document.querySelectorAll(".drawer-link").forEach((link) => link.addEventListener("click", () => setDrawer(false)));

  const category = document.querySelector("#category");
  const service = document.querySelector("#serviceId");
  const quantity = document.querySelector("#quantity");
  const total = document.querySelector("#totalValue");
  const submit = document.querySelector("#submitOrderBtn");
  if (!category || !service) return;
  let selected = null;
  async function loadServices() {
    service.disabled = true; service.innerHTML = "<option>Loading services…</option>";
    try {
      const response = await fetch(`/api/services?category=${encodeURIComponent(category.value)}`);
      if (!response.ok) throw new Error("services");
      const data = await response.json();
      service.innerHTML = '<option value="" disabled selected>Select a service</option>';
      (data.services || []).forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.available ? "✨" : "⏸️"} ${item.name}${item.available ? "" : " · unavailable"}`;
        option.disabled = !item.available;
        service.appendChild(option);
      });
      service.disabled = false;
      updateQuote();
    } catch (error) {
      service.innerHTML = '<option value="" selected>Unable to load services</option>';
      service.disabled = true;
    }
  }
  async function updateQuote() {
    selected = service.selectedOptions[0]; submit.disabled = true; total.textContent = "PHP 0.00";
    if (!service.value || !quantity.value) return;
    try {
      const r = await fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({serviceId:service.value,quantity:quantity.value})});
      if (!r.ok) throw new Error("quote");
      const q = await r.json();
      if(q.total) total.textContent=`PHP ${q.total}`;
      submit.disabled=!(q.valid && q.available);
      document.querySelector("#quantityHint").textContent=q.min?`Minimum ${q.min.toLocaleString()} · Maximum ${q.max.toLocaleString()}`:"";
    } catch (error) {
      document.querySelector("#quantityHint").textContent = "Quote unavailable. Please try again.";
    }
  }
  category.addEventListener("change", loadServices); service.addEventListener("change", updateQuote); quantity.addEventListener("input", updateQuote);
})();