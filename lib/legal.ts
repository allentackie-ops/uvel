export const PRIVACY_URL = "https://allentackie-ops.github.io/uvel/";
export const TERMS_URL = "https://allentackie-ops.github.io/uvel/terms.html";

export type LegalDoc = {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
};

export const privacy: LegalDoc = {
  title: "Privacy Policy",
  updated: "22 August 2026",
  sections: [
    {
      heading: "Who we are",
      body: [
        "Uvel is a dress-and-shop app from Fitza. Contact: himforson@gmail.com.",
        "This policy explains what we collect, why, and how you can ask us to delete it.",
      ],
    },
    {
      heading: "Information we collect",
      body: [
        "Account: email, name, and sign-in provider (Apple, Google, Facebook, or email).",
        "Photos and video: pictures of you, your clothes, and looks you share, so we can find pieces and show how they look on you.",
        "Wardrobe and listings: items you scan, save, or list to sell.",
        "Style and try-on: preferences and virtual try-on results.",
        "Device: app version, device type, and crash logs.",
        "Purchases: transaction details needed to complete orders. We do not store your full card number.",
      ],
    },
    {
      heading: "How we use it",
      body: [
        "To run your account, try clothes on you, match listings, let you sell, and keep the app working.",
        "We do not sell your personal information.",
      ],
    },
    {
      heading: "Photos, camera, and AI",
      body: [
        "Try-on and wardrobe scanning use photos you choose or take. Those images run the feature you asked for. We do not use your photos to train public models without asking you.",
      ],
    },
    {
      heading: "Who we share with",
      body: [
        "Only what is needed to run Uvel: Firebase (accounts and files), Apple / Google / Meta if you sign in with them, Expo for app updates, and Apple or Google for in-app purchases.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "You can access, correct, or delete your data from You → Settings → Delete account, or email himforson@gmail.com. We keep data while your account is open and delete it, usually within 30 days, after you ask.",
      ],
    },
    {
      heading: "Children",
      body: ["Uvel is not for children under 13. If you think we have a child’s data, email us and we will delete it."],
    },
    {
      heading: "Contact",
      body: ["Fitza / Uvel — himforson@gmail.com"],
    },
  ],
};

export const terms: LegalDoc = {
  title: "Terms and Conditions",
  updated: "23 August 2026",
  sections: [
    {
      heading: "The app",
      body: [
        "Uvel is a dress-and-shop app from Fitza. By using it you agree to these terms and the Privacy Policy.",
        "You must be 18 or older to create an account, buy, or sell.",
      ],
    },
    {
      heading: "Try-on and photos",
      body: [
        "Virtual try-on needs a photo you take or pick. Results are a preview, not a guarantee of fit. You stay responsible for how you use photos you upload.",
      ],
    },
    {
      heading: "Selling",
      body: [
        "Listings you post must be yours to sell, accurately described, and legal. Uvel can remove a listing that breaks these terms.",
      ],
    },
    {
      heading: "Acceptable use",
      body: [
        "Do not scrape the app, abuse try-on, post anyone’s photo without their consent, or use Uvel to harm others.",
      ],
    },
    {
      heading: "Changes",
      body: ["We may update these terms. The date at the top is the latest version. If you keep using Uvel after a change, you accept the new terms."],
    },
    {
      heading: "Contact",
      body: ["Fitza / Uvel — himforson@gmail.com"],
    },
  ],
};

export const DOCS: Record<string, LegalDoc> = { privacy, terms };
