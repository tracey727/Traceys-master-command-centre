(() => {
  "use strict";

  const serviceKeys = ["main", "health", "animal"];
  const cards = Object.fromEntries(
    serviceKeys.map((key) => [key, document.querySelector(`[data-service="${key}"]`)])
  );

  const overallStatus = document.getElementById("overallStatus");
  const lastUpdated = document.getElementById("lastUpdated");
  const refreshButton = document.getElementById("refreshButton");
  const apiMessage = document.getElementById("apiMessage");
  const apiAddress = document.getElementById("apiAddress");

  const setCard = (key, online, detail) => {
    const card = cards[key];
    card.classList.remove("checking", "online", "offline");
    card.classList.add(online ? "online" : "offline");
    card.querySelector(".status-text").textContent = online ? "ONLINE" : "OFFLINE";
    card.querySelector(".status-detail").textContent = detail;
  };

  const setChecking = () => {
    serviceKeys.forEach((key) => {
      const card = cards[key];
      card.classList.remove("online", "offline");
      card.classList.add("checking");
      card.querySelector(".status-text").textContent = "CHECKING";
      card.querySelector(".status-detail").textContent = "Contacting Vercel deployment status";
    });
    overallStatus.textContent = "CHECKING";
    overallStatus.style.color = "#8a6500";
  };

  const renderOverall = (services) => {
    const onlineCount = serviceKeys.filter((key) => Boolean(services[key]?.online)).length;
    if (onlineCount === serviceKeys.length) {
      overallStatus.textContent = "ALL ONLINE";
      overallStatus.style.color = "#177a45";
    } else if (onlineCount === 0) {
      overallStatus.textContent = "ALL OFFLINE";
      overallStatus.style.color = "#b42318";
    } else {
      overallStatus.textContent = `${onlineCount} OF ${serviceKeys.length} ONLINE`;
      overallStatus.style.color = "#8a6500";
    }
  };

  const setUpdatedTime = () => {
    lastUpdated.textContent = new Intl.DateTimeFormat("en-AU", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date());
  };

  const checkStatus = async () => {
    setChecking();
    refreshButton.disabled = true;
    refreshButton.textContent = "Checking…";
    apiMessage.textContent = "Contacting the Vercel deployment status file…";

    try {
      const response = await fetch(`/status.json?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Status file returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const services = data.services || {};

      serviceKeys.forEach((key) => {
        const service = services[key] || { online: false, detail: "No status returned" };
        setCard(key, Boolean(service.online), service.detail || "Deployment status checked");
      });

      renderOverall(services);
      setUpdatedTime();
      apiMessage.textContent = "Vercel deployment status responded successfully.";
      apiAddress.textContent = `${window.location.origin}/status.json`;
    } catch (error) {
      serviceKeys.forEach((key) => setCard(key, false, "Deployment status could not be reached"));
      overallStatus.textContent = "STATUS CHECK OFFLINE";
      overallStatus.style.color = "#b42318";
      setUpdatedTime();
      apiMessage.textContent = error instanceof Error ? error.message : "Status check failed";
      apiAddress.textContent = `${window.location.origin}/status.json`;
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh";
    }
  };

  refreshButton.addEventListener("click", checkStatus);
  checkStatus();
  window.setInterval(checkStatus, 30000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    });
  }
})();