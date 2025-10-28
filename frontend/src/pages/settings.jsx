// ...existing imports...
import React, { useEffect, useState } from "react";
import './settings.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Account");
  const [email, setEmail] = useState("ubaidliaqat03@gmail.com");
  const [displayName] = useState("Malik Ubaid");
  const [username] = useState("ubaid8705");

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState(email);

  // Publishing settings states
  const [visibility, setVisibility] = useState("Public");
  const [sendEmails, setSendEmails] = useState(true);
  const [commentSetting, setCommentSetting] = useState("Everyone");
  const [signature, setSignature] = useState("Thank you for reading!");
  const [autoSave, setAutoSave] = useState(true);
  const [analyticsId, setAnalyticsId] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureInput, setSignatureInput] = useState(signature);

  const tabs = ["Account", "Publishing"];

  const accountRows = [
    { label: "Email address", value: email, onClick: () => { setEmailInput(email); setShowEmailModal(true); } },
    { label: "Username and subdomain", value: `@${username}` },
    { label: "Profile information", value: displayName, avatar: true },
    { label: "Profile design", value: "Customize the appearance of your profile", arrow: true },
    { label: "Membership", value: "You dont have a membership currently", arrow: true },
    { label: "Your Medium Digest frequency", value: "Weekly", green: true },
  ];

  const publishingRows = [
    { label: "Default visibility", value: visibility, onClick: () => {
        const next = visibility === "Public" ? "Unlisted" : visibility === "Unlisted" ? "Private" : "Public";
        setVisibility(next);
      } 
    },
    { label: "Email distribution", value: sendEmails ? "Send automatically" : "Ask every time", onClick: () => setSendEmails(!sendEmails) },
    { label: "Comment preferences", value: commentSetting, onClick: () => {
        const next = commentSetting === "Everyone" ? "Followers only" : commentSetting === "Followers only" ? "Disabled" : "Everyone";
        setCommentSetting(next);
      } 
    },
    { label: "Post signature", value: signature, onClick: () => { setSignatureInput(signature); setShowSignatureModal(true); } },
    { label: "Auto-save drafts", value: autoSave ? "Enabled" : "Disabled", onClick: () => setAutoSave(!autoSave) },
    { label: "Analytics ID", value: analyticsId || "Not set", onClick: () => {
        const id = prompt("Enter your Google Analytics or Plausible ID:", analyticsId);
        if (id !== null) setAnalyticsId(id);
      } 
    },
  ];

  function handleSaveEmail() {
    setEmail(emailInput.trim());
    setShowEmailModal(false);
    // TODO: call backend to persist change
  }

  function handleSaveSignature() {
    setSignature(signatureInput.trim());
    setShowSignatureModal(false);
    // TODO: call backend to persist change
  }

  const rows = activeTab === "Account" ? accountRows : publishingRows;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold">Settings</h1>
      </header>

      <div className="flex gap-8">
        {/* Left column (main) */}
        <main className="flex-1">
          <nav className="border-b mb-6">
            <ul className="flex gap-6 text-sm text-gray-600">
              {tabs.map((t) => (
                <li
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`pb-3 cursor-pointer ${activeTab === t ? "border-b-2 border-black text-black font-medium" : ""}`}
                >
                  {t}
                </li>
              ))}
            </ul>
          </nav>

          <div className="bg-white rounded-md shadow-sm divide-y">
            {rows.map((r, i) => (
              <div key={i} className="px-6 py-5 flex items-center justify-between" onClick={r.onClick} role={r.onClick ? "button" : undefined} tabIndex={r.onClick ? 0 : undefined}>
                <div>
                  <div className="text-sm text-gray-800">{r.label}</div>
                  {r.value ? <div className="text-sm text-gray-500 mt-1 max-w-2xl">{r.value}</div> : null}
                </div>

                {r.arrow ? (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                ) : null}
              </div>
            ))}
          </div>

          {activeTab === "Account" && (
            <div className="px-6 py-6">
              <button className="text-red-600 text-sm" onClick={() => alert("Deactivate (mock)")}>Deactivate account</button>
              <div className="text-sm text-gray-500 mt-2">Deactivating will suspend your account until you sign back in.</div>

              <div className="mt-6">
                <button className="text-red-600 text-sm" onClick={() => alert("Delete (mock)")}>Delete account</button>
                <div className="text-sm text-gray-500 mt-2">Permanently delete your account and all of your content.</div>
              </div>
            </div>
          )}
        </main>

        {/* Right column (sidebar) */}
        <aside className="w-80">
          <div className="bg-white rounded-md shadow-sm p-6">
            <h4 className="text-sm font-medium mb-3">Suggested help articles</h4>
            <ul className="text-sm text-gray-700 space-y-3">
              <li className="text-gray-600 cursor-pointer">Sign in or sign up to Medium</li>
              <li className="text-gray-600 cursor-pointer">Your profile page</li>
              <li className="text-gray-600 cursor-pointer">Writing and publishing your first story</li>
              <li className="text-gray-600 cursor-pointer">About Medium's distribution system</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Email address</h3>
              <button className="modal-close" onClick={() => setShowEmailModal(false)}>×</button>
            </header>

            <div className="modal-body">
              <input className="modal-input" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
              <p className="text-sm text-gray-500">You can sign into Medium with this email address.</p>
            </div>

            <footer className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button className="btn btn-save" onClick={handleSaveEmail}>Save</button>
            </footer>
          </div>
        </div>
      )}

      {/* Signature modal */}
      {showSignatureModal && (
        <div className="modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Post signature</h3>
              <button className="modal-close" onClick={() => setShowSignatureModal(false)}>×</button>
            </header>

            <div className="modal-body">
              <textarea className="modal-input" rows={3} value={signatureInput} onChange={(e) => setSignatureInput(e.target.value)} />
              <p className="text-sm text-gray-500">This text will appear at the end of every new post you publish.</p>
            </div>

            <footer className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setShowSignatureModal(false)}>Cancel</button>
              <button className="btn btn-save" onClick={handleSaveSignature}>Save</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
