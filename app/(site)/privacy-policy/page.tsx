import { LegalPage } from "@/components/public-site/legal-page";

export const metadata = { title: "Privacy Policy", description: "How Strategic Income Group collects, uses, and protects your information." };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective="March 12, 2026"
      intro="Strategic Income Group respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect your information."
      sections={[
        {
          heading: "1. Information We Collect",
          items: [
            "Personal Information: Name, email address, phone number, and other contact details.",
            "Financial Information: Any data you provide related to financial planning or investments.",
            "Usage Data: Information about your interactions with our website.",
          ],
        },
        {
          heading: "2. How We Use Your Information",
          paragraphs: ["We use your information to:"],
          items: [
            "Provide and improve our services.",
            "Communicate with you about appointments, updates, promotions, and educational content.",
            "Respond to inquiries and provide customer support.",
            "Ensure compliance with legal and regulatory obligations.",
          ],
        },
        {
          heading: "3. Sharing Your Information",
          paragraphs: ["We do not sell, rent, or trade your personal information.", "We may share information with trusted service providers who assist with:"],
          items: ["Website hosting and maintenance", "Communication services (such as email or SMS delivery platforms)", "Marketing and analytics services"],
          sub: [
            {
              heading: "SMS Consent and Data Sharing",
              paragraphs: [
                "These providers are only permitted to use your information to perform services on our behalf.",
                "Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. All SMS opt-in data and consent information will remain confidential and will not be shared, sold, or disclosed to any third parties.",
                "Information may also be disclosed if required by law or legal process.",
              ],
            },
          ],
        },
        {
          heading: "4. Data Security",
          paragraphs: [
            "We implement reasonable administrative, technical, and physical safeguards to protect your information. However, no method of electronic transmission or storage is completely secure.",
          ],
        },
        {
          heading: "5. Your Rights",
          items: [
            "You may request access, correction, or deletion of your personal information.",
            "You may opt out of marketing communications at any time.",
            "For SMS communications, you may reply STOP to unsubscribe or HELP for assistance.",
          ],
        },
        {
          heading: "6. Cookies and Tracking Technologies",
          paragraphs: ["We use cookies and similar technologies to improve user experience and analyze website usage. You may modify your browser settings to disable cookies."],
        },
        {
          heading: "7. Third-Party Links",
          paragraphs: ["Our website may contain links to third-party websites. We are not responsible for the privacy practices of those sites."],
        },
        {
          heading: "8. Changes to This Policy",
          paragraphs: ["We may update this Privacy Policy periodically. Continued use of our services after changes constitutes acceptance of the revised policy."],
        },
        {
          heading: "9. Contact Information",
          paragraphs: ["For privacy-related inquiries, please contact Strategic Income Group at planning@strategicincomegroup.com."],
        },
      ]}
    />
  );
}
