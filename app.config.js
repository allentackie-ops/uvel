const appJson = require("./app.json");

module.exports = () => {
  const expo = appJson.expo || {};
  const payments = expo.extra?.payments || {};
  return {
    ...expo,
    extra: {
      ...expo.extra,
      payments: {
        ...payments,
        stripePk: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || payments.stripePk || "",
      },
    },
  };
};
