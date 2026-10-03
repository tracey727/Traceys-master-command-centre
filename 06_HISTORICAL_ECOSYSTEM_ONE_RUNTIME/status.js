function envIsOnline(name, fallback = true) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;

  const normalised = String(value).trim().toLowerCase();
  if (["offline", "false", "0", "down", "disabled"].includes(normalised)) return false;
  if (["online", "true", "1", "up", "enabled"].includes(normalised)) return true;
  return fallback;
}

module.exports = function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  const services = {
    main: {
      online: envIsOnline("MAIN_COMMAND_STATUS", true),
      detail: "Vercel Main Command test endpoint"
    },
    health: {
      online: envIsOnline("HEALTH_STATUS", true),
      detail: "Vercel Health test endpoint"
    },
    animal: {
      online: envIsOnline("ANIMAL_STATUS", true),
      detail: "Vercel Animal test endpoint"
    }
  };

  response.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    services
  });
};
