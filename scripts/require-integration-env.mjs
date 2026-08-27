const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PUBLIC_APP_URL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing integration environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}
