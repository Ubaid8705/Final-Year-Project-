import React from "react";
import { Link } from "react-router-dom";
import "./terms.css";

const LAST_UPDATED = "November 19, 2025";

const sections = [
  {
    id: "using-blogshive",
    title: "Using BlogsHive",
    summary:
      "BlogsHive is a publishing community built for thoughtful writing and respectful discussion.",
    paragraphs: [
      "You must be at least 13 years old, or the minimum age required in your country, to create an account. By signing up you confirm that the information you provide is accurate and that you have the authority to represent any organization you register on BlogsHive.",
      "Keep your account credentials secure and notify us immediately if you suspect unauthorized access. You are responsible for activity that happens through your account unless you have already let us know about a security issue.",
    ],
    list: [
      "Do not impersonate another person or entity or misrepresent your affiliation.",
      "Only automate activity through tools that follow our published interface guidelines.",
      "Respect any usage limits and moderation decisions communicated by BlogsHive moderators.",
    ],
  },
  {
    id: "your-content",
    title: "Your Content & Licenses",
    summary:
      "You retain ownership of the stories, comments, and media you share on BlogsHive.",
    paragraphs: [
      "When you publish on BlogsHive you grant us a limited, worldwide, royalty-free license to host, store, cache, reproduce, and distribute your content for the purpose of operating and improving our services. This license allows us to make your work available to readers, promote it within BlogsHive, and back it up across our infrastructure.",
      "You can unpublish or delete your work at any time. We may retain backup copies for a reasonable period, and we may continue to display or reference your content where it has been shared by other members, in collections, or in derivative works that rely on it.",
    ],
    list: [
      "You are responsible for securing all rights needed to share your content, including music, images, and code snippets.",
      "Label sponsored or promotional content clearly so readers understand the relationship.",
      "Granting us this license does not prevent you from publishing your work elsewhere.",
    ],
  },
  {
    id: "community",
    title: "Community Expectations",
    summary:
      "We expect every author and reader to help maintain a safe, inclusive environment.",
    paragraphs: [
      "BlogsHive is designed for nuanced discussion. Personal attacks, harassment, hate speech, or the promotion of violence are not tolerated. Content that violates these principles may be removed and accounts may be suspended.",
      "We moderate content proactively and in response to community reports. If we learn about an urgent risk of harm, we may alert appropriate authorities consistent with our legal obligations.",
    ],
    list: [
      "Share original insights, cite sources where relevant, and avoid plagiarism.",
      "Do not use BlogsHive to distribute malware, scams, or deceptive schemes.",
      "Respect readers' privacy. Do not publish sensitive personal data without consent.",
    ],
  },
  {
    id: "membership",
    title: "Memberships, Payments & Promotions",
    summary:
      "Some features on BlogsHive, such as premium publications or audience analytics, may require a paid plan.",
    paragraphs: [
      "Prices, covered features, and billing cycles are displayed at the point of purchase. Unless stated otherwise, subscriptions renew automatically until you cancel. We may change pricing with advance notice so you can review the update before your next billing cycle.",
      "If you promote paid memberships or accept payments from readers, you are solely responsible for any applicable taxes, reporting requirements, or third-party fees associated with those transactions.",
    ],
    list: [
      "Refund requests are evaluated under the policy presented during checkout.",
      "We may suspend access to paid features when invoices remain unpaid.",
      "Promotional credits or discounts expire on the date listed in the offer details.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property & Trademark",
    summary:
      "BlogsHive, its logos, and product names are protected trademarks.",
    paragraphs: [
      "You may not use our marks in a way that suggests sponsorship or endorsement without written permission. Screenshots, tutorials, or reviews that refer to BlogsHive by name are generally fine, provided they do not confuse readers about the source of the material.",
      "If you believe content on BlogsHive infringes your intellectual property rights, submit a detailed notice to support@blogshive.com and we will review it promptly.",
    ],
  },
  {
    id: "termination",
    title: "Account Suspension & Termination",
    summary:
      "We reserve the right to restrict or disable accounts that break these Terms or disrupt the community.",
    paragraphs: [
      "You may end your relationship with BlogsHive at any time by deleting your account. If you choose to leave, we will deactivate your profile and remove public access to your content within a reasonable time.",
      "BlogsHive may suspend or terminate access if you violate the law, repeatedly infringe others' rights, attempt to interfere with the service, or pose a risk to the community. We will notify you when possible, but we may act immediately in urgent situations.",
    ],
  },
  {
    id: "liability",
    title: "Disclaimers & Limitations of Liability",
    summary:
      "BlogsHive is provided on an \"as is\" basis and we make no guarantees that it will always be error-free or uninterrupted.",
    paragraphs: [
      "To the fullest extent permitted by law, BlogsHive and its team are not liable for indirect, incidental, special, consequential, or exemplary damages arising from your use of the service. In no event will our aggregate liability exceed the greater of one hundred U.S. dollars ($100) or the amount you paid to BlogsHive in the twelve months preceding the claim.",
      "Some jurisdictions do not allow certain limitations, so these provisions may not apply to you. In those cases the liability limitation will be the minimum permitted under applicable law.",
    ],
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    summary:
      "We update these Terms when we launch new features or when legal requirements shift.",
    paragraphs: [
      "When we make material changes we will post an updated version here and, when appropriate, notify you by email or through an in-product announcement. Continuing to use BlogsHive after the effective date of the revised Terms means you agree to the updated version.",
      "If you disagree with the new Terms you should discontinue using BlogsHive before the changes take effect and, if desired, delete your account.",
    ],
  },
  {
    id: "contact",
    title: "Questions & Contact",
    summary:
      "We are here to help you succeed on BlogsHive.",
    paragraphs: [
      "If you have questions about these Terms or need support, email us at support@blogshive.com. For legal notices, include your full name, contact information, and a detailed description so we can address the request quickly.",
    ],
  },
];

export default function TermsOfService() {
  return (
    <div className="terms-page">
      <header className="terms-hero">
        <p className="terms-label">Terms of Service</p>
        <h1>BlogsHive Terms &amp; Conditions</h1>
        <p className="terms-meta">Effective {LAST_UPDATED}</p>
        <p className="terms-intro">
          Thank you for choosing BlogsHive. These Terms explain your rights, your responsibilities,
          and the commitments we make to keep this community useful and safe for everyone. Please
          read them carefully.
        </p>
        <div className="terms-actions">
          <a className="terms-primary" href="#using-blogshive">
            Start reading
          </a>
          <Link className="terms-secondary" to="/">
            Return home
          </Link>
        </div>
      </header>

      <div className="terms-layout">
        <aside className="terms-toc" aria-label="Table of contents">
          <h2>In this document</h2>
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="terms-content">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="terms-section">
              <h2>{section.title}</h2>
              {section.summary && <p className="terms-summary">{section.summary}</p>}
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.id}-paragraph-${index}`}>{paragraph}</p>
              ))}
              {section.list && (
                <ul className="terms-list">
                  {section.list.map((item, index) => (
                    <li key={`${section.id}-item-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </main>
      </div>

      <footer className="terms-footer">
        <p>
          Still have questions? Reach us at <a href="mailto:support@blogshive.com">support@blogshive.com</a>.
        </p>
        <p>
          Looking for product updates? Follow our newsroom or check the latest release notes in your
          BlogsHive dashboard.
        </p>
      </footer>
    </div>
  );
}
