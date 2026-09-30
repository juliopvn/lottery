function setDefault(key: string, value: string) {
  if (!process.env[key]) process.env[key] = value;
}

setDefault("APP_URL", "http://localhost:3000");
setDefault("MONGODB_URI", "mongodb://localhost:27017");
setDefault("MONGODB_DB", "lottery_test");
setDefault("JWT_SECRET", "test-secret-please-change-me-32-chars-minimum");
setDefault("MAGIC_LINK_TTL_MINUTES", "15");
setDefault("ADMIN_EMAIL", "admin@example.com");
setDefault("STRIPE_SECRET_KEY", "sk_test_dummy_key_for_unit_tests");
setDefault("STRIPE_WEBHOOK_SECRET", "whsec_test_dummy_secret_for_signing");
setDefault("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_dummy_key_for_unit_tests");
setDefault("STRIPE_CURRENCY", "mxn");
setDefault("EMAIL_PROVIDER", "mailhog");
setDefault("EMAIL_FROM", "Lottery <test@example.com>");
setDefault("MAILHOG_HOST", "localhost");
setDefault("MAILHOG_PORT", "1025");
setDefault("E2E", "0");
setDefault("E2E_REAL_STRIPE", "0");
