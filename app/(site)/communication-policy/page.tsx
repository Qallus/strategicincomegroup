import { LegalPage } from "@/components/public-site/legal-page";

export const metadata = { title: "Communication Policy", description: "How Strategic Income Group communicates by phone, SMS, MMS and email, and how to opt out." };

export default function CommunicationPolicyPage() {
  return (
    <LegalPage
      title="Communication Policy"
      effective="November 19, 2026"
      intro="Strategic Income Group (“SIG,” “we,” “our,” or “us”) is committed to transparent, responsible, and compliant communication practices. This Communication Policy outlines how we collect consent, communicate with you via phone, SMS, MMS, and other channels, and how your communication data is handled."
      sections={[
        {
          heading: "1. Scope of Communications",
          paragraphs: ["Strategic Income Group may communicate with you through:"],
          items: [
            "Phone calls (live or automated)",
            "SMS (text messaging). SMS messages may contain links to pages on our owned domain (strategicincomegroup.com). We do not use third-party URL shorteners or link to external domains in SMS communications.",
            "Email communications",
            "Voicemail or ringless voicemail (where applicable)",
          ],
        },
        {
          heading: "2. Consent to Communicate",
          paragraphs: [
            "By providing your contact information through our website, forms, scheduling tools, or direct interaction, you consent to receive communications from Strategic Income Group, including:",
          ],
          items: [
            "Appointment confirmations and reminders",
            "Service updates and account-related notifications",
            "Educational content and financial insights",
            "Event invitations and follow-ups",
            "Customer support communications",
          ],
          sub: [
            {
              heading: "Express Consent (SMS & MMS)",
              paragraphs: [
                "SMS/MMS messages are only sent to users who have provided explicit opt-in consent. Consent may be obtained through website forms, appointment scheduling tools, written or verbal confirmation, or keyword opt-ins (e.g., texting a keyword to join).",
              ],
            },
          ],
        },
        {
          heading: "3. Message Frequency & Fees",
          items: [
            "Message frequency may vary based on your interactions with us",
            "Standard message and data rates may apply depending on your mobile carrier",
            "Strategic Income Group is not responsible for carrier fees",
          ],
        },
        {
          heading: "4. Opt-Out & User Controls",
          paragraphs: ["You may opt out of communications at any time:"],
          items: [
            "SMS / MMS: Reply STOP to unsubscribe, or HELP for assistance",
            "Email: Use the unsubscribe link included in emails",
            "Phone Calls: Request to be placed on our Do Not Call list",
          ],
          sub: [
            {
              heading: "After you opt out",
              paragraphs: ["Once you opt out, you will no longer receive non-essential communications unless required for service-related purposes."],
            },
          ],
        },
        {
          heading: "5. Use of Communication Data",
          paragraphs: ["We use your communication data to:"],
          items: [
            "Deliver requested services",
            "Manage appointments and client relationships",
            "Improve communication quality and service experience",
            "Maintain compliance with regulatory requirements",
          ],
        },
        {
          heading: "6. Data Sharing & Third-Party Providers",
          paragraphs: [
            "We do not sell, rent, or share your personal information for marketing purposes.",
            "We may share information with trusted service providers strictly for operational purposes, including:",
          ],
          items: [
            "Communication platforms (e.g., Twilio for SMS, MMS, and voice services)",
            "CRM and client management systems",
            "Website hosting and analytics providers",
          ],
          sub: [
            {
              heading: "SMS Compliance Statement",
              items: [
                "Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes",
                "All SMS opt-in data and consent records are kept confidential",
                "This information will not be sold, rented, or disclosed",
              ],
              paragraphs: ["Information may be disclosed if required by law or legal process."],
            },
          ],
        },
        {
          heading: "7. Call Recording & Monitoring",
          paragraphs: [
            "Phone calls may be recorded or monitored for quality assurance, training purposes, and compliance and documentation. By engaging in phone communication with us, you acknowledge and consent to such recording where permitted by law.",
          ],
        },
        {
          heading: "8. Data Security",
          paragraphs: ["We implement administrative, technical, and physical safeguards to protect your information. However, no communication system is 100% secure."],
        },
        {
          heading: "9. Your Rights",
          items: [
            "Access your personal information",
            "Request corrections or updates",
            "Request deletion of your data (where legally permissible)",
            "Withdraw consent for communications",
          ],
        },
        {
          heading: "10. Changes to This Policy",
          paragraphs: [
            "Strategic Income Group may update this Communication Policy from time to time. Updates will be posted with a revised effective date. Continued use of our services indicates acceptance of these changes.",
          ],
        },
        {
          heading: "11. Contact Information",
          paragraphs: ["For communication preferences or questions: Strategic Income Group, planning@strategicincomegroup.com."],
        },
      ]}
    />
  );
}
