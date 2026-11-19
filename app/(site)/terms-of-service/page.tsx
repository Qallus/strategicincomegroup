import { LegalPage } from "@/components/public-site/legal-page";

export const metadata = { title: "Terms of Service", description: "The terms that govern use of the Strategic Income Group website and services." };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effective="November 19, 2026"
      intro="Welcome to Strategic Income Group! These Terms are governed by the laws of the State of Arizona, without regard to its conflict of law principles. Any disputes arising from these Terms or your use of our services shall be resolved in the state or federal courts located in Maricopa County, Arizona."
      sections={[
        {
          heading: "1. Acceptance of Terms",
          paragraphs: [
            "By using our website and services, you acknowledge that you have read, understood, and agree to comply with these Terms. If you do not agree, please do not use our services.",
          ],
        },
        {
          heading: "2. Services Provided",
          paragraphs: [
            "Strategic Income Group provides financial education, investment resources, and related services. We reserve the right to modify, suspend, or discontinue any part of our services at any time without prior notice.",
          ],
        },
        {
          heading: "3. User Responsibilities",
          items: [
            "You must be at least 18 years old to use our services.",
            "You agree to provide accurate and complete information when registering for any of our services.",
            "You are responsible for maintaining the confidentiality of your account credentials.",
          ],
        },
        {
          heading: "4. Prohibited Activities",
          paragraphs: ["You agree not to:"],
          items: ["Use our website for any unlawful purpose.", "Interfere with or disrupt our website or services.", "Engage in any activity that violates the rights of others."],
        },
        {
          heading: "5. Intellectual Property",
          paragraphs: [
            "All content, including text, graphics, logos, and software, is the property of Strategic Income Group and protected by intellectual property laws. You may not reproduce, distribute, or modify any content without our written permission.",
          ],
        },
        {
          heading: "6. Disclaimer of Warranties",
          paragraphs: [
            "Our services are provided \"as is\" without warranties of any kind. We do not guarantee the accuracy or reliability of any financial or investment information provided.",
          ],
        },
        {
          heading: "7. Limitation of Liability",
          paragraphs: ["Strategic Income Group shall not be liable for any indirect, incidental, or consequential damages resulting from your use of our services."],
        },
        {
          heading: "8. Governing Law",
          paragraphs: [
            "These Terms are governed by the laws of the State of Arizona. Any disputes shall be resolved in the state or federal courts located in Maricopa County, Arizona.",
          ],
        },
        {
          heading: "9. Changes to Terms",
          paragraphs: ["We may update these Terms at any time. Continued use of our services after changes constitutes acceptance of the revised Terms."],
        },
        {
          heading: "10. SMS / Text Message Communications",
          paragraphs: ["If you opt in to receive SMS messages from Strategic Income Group, you agree to the following:"],
          items: [
            "You confirm that you are the owner or authorized user of the mobile phone number provided and that you are authorized to opt in to SMS communications for that number.",
            "You consent to receive SMS messages including appointment reminders, scheduling updates, service notifications, event invitations, and follow-up communications.",
            "Message frequency varies and typically ranges from 1–4 messages per month.",
            "Message and data rates from your mobile carrier may apply. Strategic Income Group is not responsible for carrier fees.",
            "SMS messages may include links to pages on strategicincomegroup.com. Strategic Income Group does not use third-party URL shorteners or include external links in SMS.",
            "You may opt out at any time by replying STOP to any message, by completing the form at strategicincomegroup.com/sms-opt-out/, or by calling (480) 466-7070.",
            "Reply HELP to any message for assistance.",
            "Carrier delivery is not guaranteed. Strategic Income Group is not liable for delayed or undelivered SMS messages.",
          ],
        },
        {
          heading: "11. Contact Information",
          paragraphs: ["For any questions regarding these Terms, please contact us at planning@strategicincomegroup.com or call (480) 466-7070."],
        },
      ]}
    />
  );
}
