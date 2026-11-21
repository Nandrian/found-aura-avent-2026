import { useEffect, useState } from "react";
import { days, type WardrobeDay } from "./days";
import {
  CAMPAIGNS,
  formatMadagascarDateTimeDisplay,
  formatMadagascarDateTimeInput,
  resolveEligibilityDisplay,
} from "./campaign";
import {
  campaignId,
  cleanRecoveryUrl,
  clearParticipantSession,
  collectCampaignDay,
  currentCampaign,
  downloadAdminCsv,
  FACEBOOK_OFFICIAL_POST_URL,
  getAdminCampaignEligibility,
  getAdminDuplicates,
  getAdminParticipants,
  getAdminRecoveryRequests,
  getCampaignStatus,
  getStoredParticipantSession,
  mergeAdminParticipants,
  migrateLegacyParticipant,
  recoverParticipant,
  recoveryLink,
  recoveryTokenFromUrl,
  registerParticipant,
  requestAssistedRecovery,
  reviewAdminRecoveryRequest,
  revokeParticipantSession,
  rotateRecoveryToken,
  supabase,
  updateAdminDrawSettings,
  type AdminParticipant,
  type CampaignEligibilitySummary,
  type CampaignId,
  type CampaignStatus,
  type MergeBackupRecord,
  type RecoveryRequestRecord,
  type SuspectedDuplicateGroup,
} from "./supabase";

type ModalProps = { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean };
type AuthState = "AUTH_LOADING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "AUTH_ERROR";
type RevealButtonState =
  | "AUTH_LOADING"
  | "ELIGIBLE"
  | "UNAUTHENTICATED"
  | "COMPLETED"
  | "FUTURE"
  | "BACKEND_ERROR"
  | "MISSED"
  | "UNAVAILABLE";

function getMadagascarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const isDevelopmentPreview = () => {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".makeproxy-c.figma.site");
};

function BrandLogo({
  compact = false,
  width,
  color,
}: {
  compact?: boolean;
  width?: number;
  color?: string;
}) {
  const finalWidth = width || (compact ? 96 : 120);
  const finalHeight = finalWidth * (251.384 / 600);
  const fillColor = color || (compact ? "#1F1F1A" : "#F9F7F2");

  return (
    <span
      className={`brand-logo-lockup ${compact ? "compact" : ""}`}
      style={{
        width: finalWidth,
        height: finalHeight,
        display: "inline-block",
        background: "transparent",
      }}
      role="img"
      aria-label="Found Aura"
    >
      <svg
        viewBox="0 0 600 251.384"
        width={finalWidth}
        height={finalHeight}
        fill={fillColor}
        style={{ display: "block", background: "transparent" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g id="brand-monogram">
          <path d="M128.73 241.442C119.99 241.442 111.293 239.892 102.769 236.749C94.2009 233.649 86.538 228.999 79.822 222.8C73.063 216.6 67.638 208.98 63.462 199.853C59.286 190.769 57.176 180.35 57.176 168.596C57.176 155.981 60.4049 144.271 66.8199 133.465C70.827 126.706 72.745 122.676 78.499 118.488C81.185 116.533 88.9439 111.472 95.5129 115.085C103.68 119.577 103.329 131.183 103.329 138.244H104.922V86.279H103.329C103.329 87.485 103.243 88.647 103.07 89.809C102.424 95.363 100.013 100.099 95.923 104.103C95.535 104.491 95.148 104.835 94.76 105.136C90.11 109.269 84.599 111.293 78.271 111.293H42.02V1.59299H46.135C65.498 1.59299 84.307 8.75399 98.379 22.055C102.039 25.515 105.242 29.087 108.064 32.85L120.762 0H0V1.59299C2.798 1.59299 5.07994 2.53999 6.88794 4.47699C8.73894 6.41399 9.64294 8.65299 9.64294 11.193V213.328C9.64294 215.911 8.73894 218.15 6.88794 220.087C5.07994 221.981 2.798 222.971 0 222.971V224.564H25.1429C23.2489 222.024 21.57 219.355 20.02 216.513C15.241 207.558 12.787 196.967 12.787 184.955C12.787 174.062 15.026 163.945 19.46 154.818C23.852 145.82 29.7499 137.855 36.9399 131.139C38.5759 129.632 40.255 128.125 42.02 126.747V113.228H79.723C75.159 114.649 68.153 116.371 63.762 118.394C55.625 122.14 48.349 126.789 42.02 132.343C41.288 132.989 40.5559 133.635 39.8669 134.28C33.0219 140.695 27.511 148.186 23.335 156.711C19.159 165.279 17.0919 174.707 17.0919 184.954C17.0919 196.277 19.331 206.136 23.808 214.488C25.789 218.104 28.027 221.463 30.61 224.562C33.839 228.566 37.585 232.096 41.804 235.153C49.295 240.621 57.82 244.668 67.464 247.337C77.108 250.006 87.0529 251.384 97.2999 251.384C114.392 251.384 130.365 247.94 145.089 241.094L144.443 239.501C139.32 240.793 134.067 241.438 128.728 241.438L128.73 241.442Z" />
          <path d="M220.649 245.274C219.702 244.628 218.668 243.552 217.635 242.045C216.559 240.581 215.353 238.515 214.105 235.974C212.813 233.391 211.177 229.99 209.283 225.684L124.167 29.792L120.077 20.363H117.193L111.08 37.197L99.24 69.788L171.397 239.159C174.195 245.143 178.802 248.157 185.217 248.157H223.405V246.865C222.544 246.434 221.64 245.918 220.65 245.272L220.649 245.274Z" />
        </g>
        <g id="brand-found" transform="translate(263.554, 0)">
          <path d="M0 0.707001H54.64V34.874H53.9331C53.9331 25.651 50.6621 17.768 44.1211 11.225C37.5781 4.68501 29.695 1.41299 20.472 1.41299H18.495V49.699H34.4491C37.4611 49.699 40.0481 48.64 42.2151 46.522C44.3791 44.405 45.463 41.793 45.463 38.687H46.1681V61.559H45.463C45.463 58.453 44.3801 55.841 42.2151 53.723C40.0481 51.606 37.4611 50.547 34.4491 50.547H18.495V94.597C18.495 95.727 18.9191 96.715 19.7671 97.562C20.6141 98.41 21.6491 98.833 22.8721 98.833V99.54H0V98.833C1.222 98.833 2.23501 98.41 3.03601 97.562C3.83401 96.715 4.23608 95.727 4.23608 94.597V5.64899C4.23608 4.51999 3.83401 3.53199 3.03601 2.68399C2.23501 1.83699 1.223 1.41299 0 1.41299V0.708008V0.707001Z" />
          <path d="M95.865 0C102.169 0 108.29 2.26001 114.219 6.77701C120.149 11.295 124.997 17.508 128.762 25.415C132.525 33.321 134.409 41.746 134.409 50.687C134.409 57.465 133.279 63.959 131.02 70.171C128.762 76.384 125.842 81.678 122.266 86.054C118.688 90.431 114.571 93.914 109.912 96.502C105.254 99.093 100.57 100.384 95.864 100.384C91.158 100.384 86.475 99.068 81.816 96.431C77.157 93.797 73.038 90.243 69.462 85.771C65.884 81.302 62.9891 75.936 60.7791 69.676C58.5661 63.418 57.4611 56.924 57.4611 50.193C57.4611 43.462 58.5671 36.97 60.7791 30.709C62.9891 24.451 65.884 19.086 69.462 14.614C73.038 10.144 77.157 6.59001 81.816 3.95401C86.474 1.32001 91.156 0.00100708 95.864 0.00100708L95.865 0ZM83.229 91.984C86.851 97.116 91.064 99.679 95.865 99.679C100.666 99.679 104.901 97.116 108.572 91.984C112.243 86.855 114.926 80.596 116.62 73.206C118.314 65.818 119.161 58.148 119.161 50.193C119.161 42.238 118.314 34.57 116.62 27.178C114.926 19.79 112.243 13.532 108.572 8.39999C104.902 3.27099 100.666 0.705994 95.865 0.705994C91.064 0.705994 86.851 3.27099 83.229 8.39999C79.605 13.532 76.921 19.79 75.181 27.178C73.438 34.569 72.5691 42.24 72.5691 50.193C72.5691 58.146 73.438 65.819 75.181 73.206C76.921 80.596 79.605 86.855 83.229 91.984Z" />
          <path d="M183.824 0.707001H206.696V1.41199H206.273C203.354 1.41199 200.859 2.47099 198.79 4.58899C196.718 6.70699 195.684 9.22601 195.684 12.143V80.195C195.684 85.561 193.778 90.127 189.966 93.891C186.153 97.657 181.612 99.538 176.341 99.538H168.858C164.905 99.538 161.351 99.164 158.198 98.409C155.043 97.657 152.502 96.715 150.575 95.585C148.644 94.455 146.997 93.184 145.633 91.772C144.267 90.36 143.279 88.973 142.668 87.607C142.055 86.243 141.585 84.973 141.256 83.795C140.925 82.619 140.761 81.701 140.761 81.042V5.647C140.761 4.518 140.359 3.53001 139.561 2.68201C138.76 1.83501 137.748 1.41101 136.525 1.41101V0.705994H159.398V1.41101C158.173 1.41101 157.138 1.83501 156.292 2.68201C155.444 3.53001 155.021 4.518 155.021 5.647V79.63C155.021 85.09 156.267 89.654 158.762 93.324C161.255 96.995 164.621 98.83 168.857 98.83H176.34C181.423 98.83 185.775 97.019 189.4 93.395C193.022 89.773 194.835 85.371 194.835 80.194V12.425C194.835 9.41299 193.776 6.826 191.659 4.659C189.541 2.495 186.929 1.41101 183.823 1.41101V0.705994L183.824 0.707001Z" />
          <path d="M246.792 0.707001H269.524V1.41199C266.511 1.41199 263.923 2.495 261.758 4.66C259.591 6.827 258.51 9.41399 258.51 12.426V99.538H257.805L213.472 3.672C213.378 3.484 213.236 3.41299 213.048 3.45999C212.858 3.50799 212.767 3.62501 212.767 3.81201V87.819C212.767 90.832 213.848 93.42 216.013 95.585C218.177 97.75 220.765 98.831 223.779 98.831V99.538H201.048V98.831C204.059 98.831 206.646 97.75 208.813 95.585C210.977 93.421 212.061 90.833 212.061 87.819V0.707001H227.591C227.684 0.707001 227.779 0.754992 227.874 0.847992L257.241 64.241C257.241 64.431 257.334 64.501 257.524 64.453C257.711 64.407 257.807 64.289 257.807 64.1V12.426C257.807 9.41399 256.724 6.827 254.559 4.66C252.392 2.496 249.805 1.41199 246.793 1.41199V0.707001H246.792Z" />
          <path d="M289.713 0.707001C293.759 0.707001 297.831 1.22501 301.925 2.26001C306.019 3.29601 310.161 5.06099 314.35 7.55399C318.537 10.049 322.256 13.108 325.503 16.732C328.751 20.356 331.385 25.062 333.41 30.85C335.433 36.639 336.446 43.063 336.446 50.122C336.446 56.899 335.739 63.041 334.328 68.547C332.916 74.053 331.08 78.479 328.822 81.819C326.562 85.161 324.067 88.055 321.339 90.502C318.608 92.951 315.879 94.716 313.151 95.797C310.419 96.879 307.926 97.75 305.668 98.409C303.408 99.068 301.573 99.397 300.161 99.397L298.044 99.538H270.089V98.831C271.311 98.831 272.324 98.408 273.125 97.56C273.923 96.713 274.325 95.725 274.325 94.595V5.647C274.325 4.518 273.923 3.53001 273.125 2.68201C272.324 1.83501 271.312 1.41101 270.089 1.41101V0.705994H289.715L289.713 0.707001ZM298.043 98.831C302.844 98.831 307.055 96.338 310.679 91.349C314.302 86.361 316.985 80.243 318.727 72.994C320.467 65.748 321.339 58.123 321.339 50.122C321.339 42.874 320.726 36.38 319.503 30.638C318.278 24.898 316.679 20.238 314.703 16.661C312.726 13.085 310.326 10.12 307.501 7.76599C304.677 5.41499 301.805 3.76601 298.889 2.82401C295.971 1.88401 292.818 1.41199 289.43 1.41199H288.582V98.831H298.042H298.043Z" />
        </g>
        <g id="brand-aura" transform="translate(263.555, 131.467)">
          <path d="M84.111 114.435C84.454 115.805 85.1949 116.92 86.3379 117.775C87.4779 118.632 88.7369 119.059 90.1069 119.059V119.916H62.5249V119.059C64.0079 119.059 65.0949 118.69 65.7799 117.946C66.4659 117.204 66.75 116.434 66.637 115.633L66.4659 114.606L57.215 75.376H25.5229L17.6439 106.041C16.7279 109.354 17.328 112.353 19.443 115.035C21.555 117.72 24.266 119.06 27.58 119.06V119.917H0V119.06C3.88 119.06 7.39191 117.861 10.5349 115.464C13.6739 113.065 15.7 109.925 16.616 106.042L41.2839 10.452C41.5129 9.31203 41.5129 8.169 41.2839 7.026C40.8269 5.2 39.8839 3.71405 38.4579 2.57104C37.0279 1.43104 35.4009 0.858032 33.5759 0.858032H29.636V0.00201416H57.3879L84.1119 114.436L84.111 114.435ZM25.694 74.521H57.043L42.1399 10.623L25.694 74.521Z" />
          <path d="M140.471 0.0010376H168.223V0.856995H167.71C164.168 0.856995 161.141 2.14104 158.63 4.71204C156.115 7.28204 154.861 10.338 154.861 13.877V96.447C154.861 102.958 152.548 108.498 147.923 113.065C143.297 117.634 137.786 119.917 131.391 119.917H122.311C117.515 119.917 113.203 119.463 109.377 118.547C105.549 117.634 102.466 116.491 100.127 115.121C97.784 113.749 95.785 112.208 94.131 110.495C92.474 108.782 91.275 107.099 90.533 105.442C89.789 103.788 89.2189 102.246 88.8199 100.817C88.4189 99.39 88.22 98.2771 88.22 97.4771V5.99701C88.22 4.62701 87.7329 3.42805 86.7639 2.39905C85.7919 1.37205 84.5639 0.856995 83.0809 0.856995V0.0010376H110.834V0.856995C109.348 0.856995 108.092 1.37105 107.065 2.39905C106.036 3.42805 105.523 4.62601 105.523 5.99701V95.764C105.523 102.389 107.035 107.927 110.062 112.38C113.087 116.835 117.171 119.061 122.31 119.061H131.39C137.558 119.061 142.838 116.864 147.236 112.466C151.631 108.071 153.831 102.731 153.831 96.449V14.222C153.831 10.567 152.547 7.42805 149.978 4.80005C147.408 2.17405 144.239 0.860046 140.47 0.860046V0.00402832L140.471 0.0010376Z" />
          <path d="M238.63 114.092C238.857 114.435 239.17 114.892 239.572 115.464C239.971 116.035 240.712 116.777 241.799 117.69C242.883 118.606 243.996 119.06 245.139 119.06V119.917H217.387V119.06C218.757 119.06 219.64 118.661 220.042 117.861C220.441 117.064 220.471 116.207 220.128 115.292L219.785 114.092L198.03 66.64H191.176V113.921C191.176 117.347 192.946 119.06 196.487 119.06V119.917H168.735V119.06C170.218 119.06 171.447 118.547 172.418 117.518C173.387 116.491 173.874 115.292 173.874 113.92V5.99603C173.874 4.62603 173.387 3.42701 172.418 2.39801C171.446 1.37101 170.218 0.856018 168.735 0.856018V0H197.001C205.566 0 213.16 1.14303 219.785 3.42603C226.407 5.71203 231.833 9.421 236.06 14.56C240.283 19.699 242.399 26.038 242.399 33.576C242.399 38.259 241.597 42.4841 240 46.2531C238.4 50.0211 236.231 53.078 233.491 55.417C230.749 57.76 227.949 59.645 225.096 61.07C222.24 62.5 219.101 63.669 215.675 64.582L216.016 64.411L238.63 114.091V114.092ZM200.599 65.784C202.425 65.671 204.224 65.384 205.995 64.927C207.764 64.473 209.791 63.53 212.077 62.101C214.36 60.674 216.33 58.845 217.986 56.619C219.64 54.392 221.071 51.281 222.269 47.282C223.468 43.286 224.068 38.69 224.068 33.492C224.068 28.294 223.354 23.671 221.926 19.616C220.497 15.563 218.757 12.394 216.701 10.108C214.645 7.82503 212.303 5.96904 209.677 4.54004C207.048 3.11304 204.735 2.14105 202.739 1.62805C200.739 1.11405 198.884 0.856018 197.171 0.856018H191.175V65.783H200.597L200.599 65.784Z" />
          <path d="M330.449 114.435C330.792 115.805 331.533 116.92 332.676 117.775C333.816 118.632 335.075 119.059 336.445 119.059V119.916H308.863V119.059C310.346 119.059 311.433 118.69 312.118 117.946C312.804 117.204 313.088 116.434 312.975 115.633L312.804 114.606L303.553 75.376H271.861L263.982 106.041C263.066 109.354 263.666 112.353 265.781 115.035C267.893 117.72 270.604 119.06 273.918 119.06V119.917H246.338V119.06C250.218 119.06 253.73 117.861 256.873 115.464C260.012 113.065 262.038 109.925 262.954 106.042L287.622 10.452C287.851 9.31203 287.851 8.169 287.622 7.026C287.165 5.2 286.222 3.71405 284.796 2.57104C283.366 1.43104 281.739 0.858032 279.914 0.858032H275.974V0.00201416H303.726L330.45 114.436L330.449 114.435ZM272.032 74.521H303.381L288.478 10.623L272.032 74.521Z" />
        </g>
      </svg>
    </span>
  );
}

function Modal({ children, onClose, label, wide }: ModalProps) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={onClose}
    >
      <div
        className={`modal-card ${wide ? "modal-wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function Header({ onPassport, onRules }: { onPassport: () => void; onRules: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    const mobileQuery = window.matchMedia("(max-width: 900px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    mobileQuery.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      mobileQuery.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="site-header">
        <button
          className="brand brand-mark"
          onClick={() => {
            closeMobileMenu();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Found Aura — retour en haut"
        >
          <BrandLogo width={120} />
        </button>
        <nav aria-label="Navigation principale">
          <a href="#wardrobe">Le Dressing</a>
          <button onClick={onPassport}>Mon Aura Passport</button>
          <button onClick={onRules}>Comment jouer</button>
        </nav>
        <a className="header-date" href="#wardrobe">
          {currentCampaign.dateBadge}
        </a>
        <button
          type="button"
          className={`mobile-menu-toggle ${mobileMenuOpen ? "open" : ""}`}
          aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span className="mobile-menu-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{mobileMenuOpen ? "Fermer" : "Menu"}</span>
        </button>
      </header>
      {mobileMenuOpen && (
        <div className="mobile-menu-layer" onClick={closeMobileMenu}>
          <nav
            id="mobile-navigation"
            className="mobile-menu-panel"
            aria-label="Navigation mobile"
            onClick={(event) => event.stopPropagation()}
          >
            <a href="#wardrobe" onClick={closeMobileMenu}>
              Le Dressing
            </a>
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                onPassport();
              }}
            >
              Mon Aura Passport
            </button>
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                onRules();
              }}
            >
              Comment jouer
            </button>
          </nav>
        </div>
      )}
    </>
  );
}

function Hero({ onEnter, onRules }: { onEnter: () => void; onRules: () => void }) {
  return (
    <section className="hero">
      <div className="hero-image" />
      <div className="hero-grain" />
      <div className="hero-content">
        <p className="eyebrow">Found Aura présente</p>
        <h1>
          <span>The Secret</span>
          <span>Wardrobe</span>
        </h1>
        <p className="tagline">{currentCampaign.tagline}</p>
        <p className="hero-copy">{currentCampaign.heroCopy}</p>
        <div className="hero-actions">
          <button className="primary light" onClick={onEnter}>
            Entrer dans le dressing <span>↗</span>
          </button>
          <button className="text-button" onClick={onRules}>
            Comment jouer ?
          </button>
        </div>
      </div>
      <a className="scroll-cue" href="#wardrobe">
        <span>Découvrir</span>
        <i />
      </a>
      <p className="partner">
        Une expérience imaginée avec <strong>MaintyBox</strong>
      </p>
    </section>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  const steps = [
    ["01", "Inscrivez-vous gratuitement"],
    ["02", "Conservez votre lien privé"],
    ["03", "Ouvrez la porte du jour"],
    ["04", "Revenez chaque jour"],
    ["05", "Collectez vos 24 Auras pour le grand tirage"],
  ];
  return (
    <Modal onClose={onClose} label="Comment jouer" wide>
      <div className="rules">
        <p className="eyebrow dark">Le rituel quotidien</p>
        <h2>
          Comment <em>jouer ?</em>
        </h2>
        <div className="rule-steps">
          {steps.map(([n, text]) => (
            <div key={n}>
              <span>{n}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>

        <div className="rules-note">
          <h3>À savoir avant de commencer</h3>

          <p>
            Du 01 au 24 décembre 2026, chaque porte s'ouvre de 00:00 à 23:59, heure d'Antananarivo
            (UTC+3). Les portes futures restent verrouillées jusqu'à leur date officielle. Une
            ouverture manquée ne peut pas être validée rétroactivement, mais son contenu reste
            consultable. Une seule validation par participant et par jour. Aucun achat requis.
          </p>

          <h3>Le grand tirage au sort</h3>

          <p>
            Pour participer au grand tirage, votre objectif est de collecter les 24 Auras du
            calendrier. L'obtention de 24/24 constitue la priorité d'éligibilité.
          </p>

          <p>
            Règle du seuil dégressif : si aucun participant n'atteint 24/24, le seuil d'éligibilité
            descend automatiquement à 23/24, puis 22/24, jusqu'au score le plus élevé atteint par au
            moins un participant. Seuls les participants ayant obtenu ce meilleur score admissible
            entreront dans le tirage au sort (une entrée par personne).
          </p>

          <p>
            Un score minimum admissible sera finalisé et publié avant le 01 décembre. Si aucun
            participant n'atteint ce minimum, aucun participant ne sera qualifié conformément au
            règlement.
          </p>

          <p>
            Authentification et clôture : seules les validations serveur enregistrées font foi (une
            capture seule ne constitue pas une preuve). Le calcul officiel du seuil final s'effectue
            après la clôture du calendrier le 25 décembre 2026 à 00:00 (heure de Madagascar). Avant
            la clôture, l'éligibilité reste en attente de confirmation. Le gagnant sera sélectionné
            séparément par Found Aura parmi les participants vérifiés éligibles.
          </p>

          <p className="placeholder">
            Règlement officiel déposé · Found Aura Madagascar · Tirage supervisé sans obligation
            d'achat.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Compartment({
  day,
  state,
  onClick,
  preview,
  isBeta,
  campaignDate,
}: {
  day: WardrobeDay;
  state: "available" | "opened" | "missed" | "locked";
  onClick: () => void;
  preview: boolean;
  isBeta?: boolean;
  campaignDate?: string;
}) {
  const styles = ["door", "drawer", "tag", "panel"];
  const dateLabel = campaignDate
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        timeZone: "Indian/Antananarivo",
      })
        .format(new Date(`${campaignDate}T12:00:00+03:00`))
        .replace(".", "")
        .toUpperCase()
    : "INACTIF";
  const stateLabel =
    state === "opened"
      ? "Collectée"
      : state === "available"
        ? "Aujourd’hui"
        : state === "missed"
          ? "Manqué"
          : isBeta
            ? "Bêta"
            : dateLabel;
  return (
    <button
      className={`compartment ${styles[(day.day - 1) % 4]} ${state}`}
      onClick={onClick}
      disabled={!preview && state !== "available" && state !== "opened" && state !== "missed"}
      aria-label={
        isBeta && day.day <= 2
          ? `Jour ${day.day}, ${dateLabel}, ${state}`
          : `Jour ${day.day}, ${state}`
      }
    >
      <span className="comp-top">{isBeta ? `${dateLabel} · ${stateLabel}` : stateLabel}</span>
      <strong>{String(day.day).padStart(2, "0")}</strong>
      <span className="comp-icon">{state === "opened" ? "✓" : state === "locked" ? "—" : "·"}</span>
      <i className="knob" />
    </button>
  );
}

function Wardrobe({
  availableDay,
  completed,
  missed,
  onOpen,
  loading,
  error,
  campaignDays,
}: {
  availableDay: number | null;
  completed: Set<number>;
  missed: Set<number>;
  onOpen: (d: WardrobeDay) => void;
  loading: boolean;
  error: string;
  campaignDays: string[];
}) {
  const getState = (day: number) =>
    completed.has(day)
      ? "opened"
      : day > campaignDays.length
        ? "locked"
        : missed.has(day)
          ? "missed"
          : day === availableDay
            ? "available"
            : "locked";
  return (
    <section id="wardrobe" className="wardrobe-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow dark">
            {currentCampaign.isBeta ? "Bêta · 13–14 novembre 2026" : "Décembre 2026 · Antananarivo"}
          </p>
          <h2 id="wardrobe-heading" tabIndex={-1}>
            Le Dressing <em>Secret</em>
          </h2>
        </div>
        <p>
          {currentCampaign.isBeta
            ? "Deux jours d'exploration bêta pour découvrir le Dressing Secret."
            : "Du 01 au 24 décembre 2026, ouvrez la porte du jour. Derrière chacune, une surprise exclusive pour révéler votre Aura."}
        </p>
      </div>
      <div className="status-legend">
        <span>
          <i className="sage" /> Disponible
        </span>
        <span>
          <i className="checked" /> Collectée
        </span>
        <span>
          <i /> À venir
        </span>
        {loading && <b>Synchronisation…</b>}
        {error && <b>{error}</b>}
      </div>
      <div className="wardrobe-frame">
        <div className="wardrobe-crown">
          <span>F</span>
          <p>THE SECRET WARDROBE</p>
          <span>A</span>
        </div>
        <div className="calendar-grid">
          {days.map((day) => (
            <Compartment
              key={day.day}
              day={day}
              state={getState(day.day)}
              onClick={() => onOpen(day)}
              preview={false}
              isBeta={currentCampaign.isBeta}
              campaignDate={campaignDays[day.day - 1]}
            />
          ))}
        </div>
        <div className="wardrobe-base">
          <span>CURATED SECOND-HAND FASHION</span>
          <span>ANTANANARIVO</span>
        </div>
      </div>
    </section>
  );
}

function DailyInteraction({ day }: { day: WardrobeDay }) {
  const [choice, setChoice] = useState("");
  const [slide, setSlide] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const options: Record<string, string[]> = {
    quiz: ["Des lignes nettes", "Des matières fluides", "Un détail inattendu"],
    vote: ["Allure Tailoring", "Minimalisme Fluide"],
    color: ["Sauge poudrée", "Cacao profond", "Champagne doux"],
    match: ["Pantalon ivoire", "Jupe satin taupe", "Jean droit brut"],
    detail: ["Les boutons nacrés", "Le revers contrasté", "La manche retroussée"],
    pair: ["Ton sur ton", "Contraste doux", "Texture sur texture"],
  };
  if (day.kind === "carousel") {
    const looks = ["01 · Le bureau délié", "02 · Le week-end précis", "03 · Le soir lumineux"];
    return (
      <div className="interaction carousel">
        <button onClick={() => setSlide((slide + 2) % 3)}>←</button>
        <p>{looks[slide]}</p>
        <button onClick={() => setSlide((slide + 1) % 3)}>→</button>
      </div>
    );
  }
  if (day.kind === "builder") {
    return (
      <div className="builder">
        {["Haut", "Bas", "Finale"].map((part, i) => (
          <button key={part} onClick={(e) => e.currentTarget.classList.toggle("selected")}>
            <span>{part}</span>
            <b>{["Chemise ivoire", "Pantalon ample", "Ceinture cacao"][i]}</b>
          </button>
        ))}
      </div>
    );
  }
  if (day.kind === "mystery" || day.kind === "finale") {
    return (
      <button className={`ribbon ${revealed ? "revealed" : ""}`} onClick={() => setRevealed(true)}>
        <span>{revealed ? "Révélé pour vous" : "Tirer le ruban"}</span>
        <i />
      </button>
    );
  }
  if (day.kind === "transform") {
    return (
      <div className="transform">
        <span>Jour</span>
        <input type="range" aria-label="Transformer la tenue" />
        <span>Nuit</span>
      </div>
    );
  }
  if (options[day.kind]) {
    return (
      <div className="choices">
        {options[day.kind].map((option) => (
          <button
            className={choice === option ? "selected" : ""}
            onClick={() => setChoice(option)}
            key={option}
          >
            {option}
            <span>○</span>
          </button>
        ))}
        {choice && (
          <p>
            Votre choix est noté : <strong>{choice}</strong>
          </p>
        )}
      </div>
    );
  }
  if (day.kind === "offer")
    return (
      <div className="offer-ticket">
        <span>PRIVILÈGE DU JOUR</span>
        <strong>— XX%</strong>
        <small>Valeur et conditions à confirmer</small>
      </div>
    );
  return (
    <div className="editorial-note">
      <span>FA</span>
      <p>Une pièce choisie avec intention, une allure qui dure au-delà des saisons.</p>
    </div>
  );
}

function Reveal({
  day,
  collected,
  buttonState,
  unavailableMessage,
  onClose,
  onCollect,
  onAuthenticate,
  onRetry,
}: {
  day: WardrobeDay;
  collected: boolean;
  buttonState: RevealButtonState;
  unavailableMessage?: string;
  onClose: () => void;
  onCollect: () => Promise<void>;
  onAuthenticate: () => void;
  onRetry: () => Promise<void>;
}) {
  const [success, setSuccess] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const collect = async () => {
    setCollecting(true);
    setError("");
    try {
      await onCollect();
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La validation a échoué.");
    } finally {
      setCollecting(false);
    }
  };
  const buttonLabel = collecting
    ? "VALIDATION…"
    : buttonState === "AUTH_LOADING"
      ? "VÉRIFICATION DE VOTRE CONNEXION..."
      : buttonState === "ELIGIBLE"
        ? "COLLECTER MON AURA"
        : buttonState === "UNAUTHENTICATED"
          ? "SE CONNECTER POUR PARTICIPER"
          : buttonState === "COMPLETED"
            ? "AURA DÉJÀ COLLECTÉE"
            : buttonState === "FUTURE"
              ? "DISPONIBLE DEMAIN"
              : buttonState === "BACKEND_ERROR"
                ? "RÉESSAYER"
                : buttonState === "MISSED"
                  ? "JOUR MANQUÉ"
                  : "INDISPONIBLE AUJOURD’HUI";
  const disabled =
    collecting ||
    buttonState === "AUTH_LOADING" ||
    buttonState === "COMPLETED" ||
    buttonState === "FUTURE" ||
    buttonState === "MISSED" ||
    buttonState === "UNAVAILABLE";
  const handleButton = () => {
    if (buttonState === "ELIGIBLE") void collect();
    else if (buttonState === "UNAUTHENTICATED") onAuthenticate();
    else if (buttonState === "BACKEND_ERROR") void onRetry();
  };
  return (
    <Modal onClose={onClose} label={`Jour ${day.day}: ${day.title}`} wide>
      <div className="reveal">
        <div className="reveal-image" style={{ backgroundImage: `url("${day.image}")` }}>
          <span>JOUR {String(day.day).padStart(2, "0")}</span>
          <small>Photo éditoriale · Unsplash</small>
        </div>
        <div className="reveal-content">
          <p className="eyebrow dark">La découverte du jour</p>
          <h2>{day.title}</h2>
          <p className="reveal-description">{day.description}</p>
          <p className="reveal-note">{day.note}</p>
          <DailyInteraction day={day} />
          {(success || collected) && (
            <div className="success">
              <span>✓</span>
              <div>
                <strong>Votre Aura du jour a été collectée !</strong>
                <p>Rendez-vous demain pour une nouvelle découverte.</p>
              </div>
            </div>
          )}
          <button className="primary" disabled={disabled} onClick={handleButton}>
            {buttonLabel} <span>↗</span>
          </button>
          {!collected && buttonState !== "ELIGIBLE" && unavailableMessage && (
            <p className="fine-print">{unavailableMessage}</p>
          )}
          {error && <p className="fine-print">{error}</p>}
          {day.shopping && (
            <button
              className="shopping"
              onClick={() =>
                alert("Prototype : cette action ouvrira la sélection Found Aura sur WhatsApp.")
              }
            >
              Découvrir la sélection <span>↗</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Passport({
  campaignStatus,
  loading,
  error,
  onClose,
  onRecovery,
  onRetry,
  onSessionExpired,
}: {
  campaignStatus: CampaignStatus | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRecovery: () => Promise<void>;
  onRetry: () => void;
  onSessionExpired: () => void;
}) {
  const isSessionExpired =
    Boolean(error) &&
    (error.includes("401") ||
      error.includes("invalide ou expirée") ||
      error.includes("expiré") ||
      error.includes("PARTICIPANT_AUTH_REQUIRED"));

  const passportState: "LOADING" | "AUTHENTICATED" | "SESSION_EXPIRED" | "ERROR" = isSessionExpired
    ? "SESSION_EXPIRED"
    : campaignStatus
      ? "AUTHENTICATED"
      : loading
        ? "LOADING"
        : error
          ? "ERROR"
          : "LOADING";

  const total = campaignStatus?.collectedDays.length || 0;
  const totalDays = campaignStatus?.campaign.totalDays || fallbackCampaignDays.length;
  const campaignDays = campaignStatus?.campaign.days || fallbackCampaignDays;
  const completed = new Set<number>(
    campaignStatus?.collectedDays
      .map((date) => campaignDays.indexOf(date) + 1)
      .filter((value) => value > 0) || [],
  );
  const campaignEnded = Boolean(campaignStatus?.summary.campaignEnded);
  const eligibility = campaignStatus
    ? resolveEligibilityDisplay({
        campaignId: campaignStatus.campaign.id,
        madagascarDate: campaignStatus.madagascarDate,
        campaignEnded,
        eligible: campaignStatus.eligible,
        eligibilityStatus: campaignStatus.eligibilityStatus,
        eligibilityMessage: campaignStatus.eligibilityMessage,
      })
    : null;
  return (
    <Modal onClose={onClose} label="Mon Aura Passport" wide>
      <div className="passport">
        <div className="passport-head">
          <div>
            <p className="eyebrow dark">
              {currentCampaign.isBeta
                ? "Found Aura · Bêta novembre 2026"
                : "Found Aura · Décembre 2026"}
            </p>
            <h2>
              My Aura <em>Passport</em>
            </h2>
            <p>« Votre voyage officiel dans le dressing secret. »</p>
          </div>
          <div className="passport-count">
            <strong>{passportState === "AUTHENTICATED" ? total : "—"}</strong>
            <span>
              / {totalDays} Auras
              <br />
              collectées
            </span>
          </div>
        </div>
        <div className="traveler">
          <span>Participante</span>
          <strong>
            {passportState === "AUTHENTICATED"
              ? campaignStatus?.participant.fullName
              : passportState === "LOADING"
                ? "Synchronisation en cours…"
                : "Non connectée"}
          </strong>
          <i>FA</i>
        </div>
        <div className="progress">
          <i
            style={{
              width: passportState === "AUTHENTICATED" ? `${(total / totalDays) * 100}%` : "0%",
            }}
          />
        </div>
        <div className="stamps">
          {days.map(({ day }) => (
            <div
              className={passportState === "AUTHENTICATED" && completed.has(day) ? "done" : ""}
              key={day}
            >
              <span>{String(day).padStart(2, "0")}</span>
              {passportState === "AUTHENTICATED" && completed.has(day) && <b>✓</b>}
            </div>
          ))}
        </div>

        {passportState === "LOADING" && (
          <div className="eligibility progress">
            <span>Synchronisation</span>
            <div>
              <strong>Chargement de votre participation sécurisée…</strong>
              <p>Récupération des validations officielles depuis le serveur Found Aura.</p>
            </div>
          </div>
        )}

        {passportState === "AUTHENTICATED" && (
          <div className={`eligibility ${eligibility?.isEligible ? "eligible" : "progress"}`}>
            <span>{eligibility?.label}</span>
            <div>
              <strong>
                {eligibility?.state === "PENDING"
                  ? total === totalDays
                    ? `Vos ${totalDays} Auras sont collectées. Éligibilité en attente de confirmation.`
                    : `${total}/${totalDays} validée(s). Éligibilité en attente.`
                  : campaignEnded
                    ? eligibility?.isEligible
                      ? `Félicitations ! Votre score (${total}/${totalDays}) vous qualifie pour le grand tirage.`
                      : `Campagne clôturée : ${total}/${totalDays} validée(s).`
                    : `${total}/${totalDays} validée(s).`}
              </strong>
              <p>
                Code officiel : <strong>{campaignStatus?.participant.participationCode}</strong>
              </p>
            </div>
          </div>
        )}

        {passportState === "ERROR" && (
          <div className="eligibility progress" style={{ borderLeftColor: "#7d443b" }}>
            <span style={{ background: "#7d443b", color: "#fff" }}>Erreur</span>
            <div>
              <strong>Impossible de synchroniser votre participation</strong>
              <p>{error || "Une erreur est survenue lors du chargement."}</p>
            </div>
            <button
              type="button"
              className="primary"
              style={{ padding: "8px 16px", fontSize: "10px", marginTop: "8px" }}
              onClick={onRetry}
            >
              Réessayer la synchronisation <span>↗</span>
            </button>
          </div>
        )}

        {passportState === "SESSION_EXPIRED" && (
          <div className="eligibility progress" style={{ borderLeftColor: "var(--taupe)" }}>
            <span>Session expirée</span>
            <div>
              <strong>Votre session participante a expiré</strong>
              <p>
                Utilisez votre lien privé de récupération pour restaurer instantanément votre compte
                et vos Auras.
              </p>
            </div>
            <button
              type="button"
              className="primary"
              style={{ padding: "8px 16px", fontSize: "10px", marginTop: "8px" }}
              onClick={onSessionExpired}
            >
              Retrouver mon accès <span>↗</span>
            </button>
          </div>
        )}

        {passportState === "AUTHENTICATED" && (
          <button className="text-button" onClick={() => void onRecovery()}>
            Créer ou remplacer mon lien privé
          </button>
        )}
      </div>
    </Modal>
  );
}

function CompletionCard({
  campaignStatus,
  capture = false,
}: {
  campaignStatus: CampaignStatus;
  capture?: boolean;
}) {
  const { collectedCount, missedCount, score } = campaignStatus.summary;
  const totalDays = campaignStatus.campaign.totalDays;
  const eligibility = resolveEligibilityDisplay({
    campaignId: campaignStatus.campaign.id,
    madagascarDate: campaignStatus.madagascarDate,
    campaignEnded: campaignStatus.summary.campaignEnded,
    eligible: campaignStatus.eligible,
    eligibilityStatus: campaignStatus.eligibilityStatus,
    eligibilityMessage: campaignStatus.eligibilityMessage,
  });

  return (
    <article className={`completion-card ${capture ? "capture-card" : ""}`}>
      <div className="completion-card-top">
        <BrandLogo compact color="#1F1F1A" />
        <span>ANTANANARIVO · 2026</span>
      </div>
      <div className="completion-identity">
        <p>FOUND AURA</p>
        <h3>THE SECRET WARDROBE</h3>
        <span>
          DECEMBER 2026 · {totalDays} DAYS. {totalDays} DISCOVERIES.
        </span>
      </div>
      <div className="completion-message">
        <p>Official Participation Ticket</p>
        <h4>
          {score} Auras
          <br />
          Validées.
        </h4>
        <span>{campaignStatus.participant.fullName}</span>
      </div>
      <div className="completion-total">
        <strong>
          {collectedCount}
          <small>/{totalDays}</small>
        </strong>
        <span>
          jours
          <br />
          complétés
        </span>
      </div>
      <div className="completion-stamps" aria-label={`${collectedCount} Auras collectées`}>
        {campaignStatus.campaign.days.map((date, index) => (
          <span key={date}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <i>{campaignStatus.collectedDays.includes(date) ? "✓" : "×"}</i>
          </span>
        ))}
      </div>
      <div className="completion-code">
        <span>Code officiel de participation</span>
        <strong>{campaignStatus.participant.participationCode}</strong>
        <small>
          {missedCount} JOUR{missedCount === 1 ? "" : "S"} MANQUÉ{missedCount === 1 ? "" : "S"} ·{" "}
          {eligibility.ticketLabel}
        </small>
      </div>
      <div className="completion-card-bottom">
        <span>The Secret Wardrobe · 24 Auras</span>
        <i>FA</i>
        <span>With MaintyBox</span>
      </div>
    </article>
  );
}

function CaptureView({
  campaignStatus,
  onClose,
}: {
  campaignStatus: CampaignStatus;
  onClose: () => void;
}) {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2200);
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);
  return (
    <div
      className="capture-view"
      onClick={onClose}
      role="dialog"
      aria-label="Carte prête à capturer"
    >
      {hint && <p className="capture-hint">Votre carte est prête · touchez le fond pour revenir</p>}
      <div onClick={(event) => event.stopPropagation()}>
        <CompletionCard campaignStatus={campaignStatus} capture />
      </div>
    </div>
  );
}

function Finale({
  campaignStatus,
  onCapture,
}: {
  campaignStatus: CampaignStatus | null;
  onCapture: () => void;
}) {
  const summaryAvailable = Boolean(campaignStatus?.summary.campaignEnded);
  const totalDays = campaignStatus?.campaign.totalDays || fallbackCampaignDays.length;
  const eligibility = campaignStatus
    ? resolveEligibilityDisplay({
        campaignId: campaignStatus.campaign.id,
        madagascarDate: campaignStatus.madagascarDate,
        campaignEnded: campaignStatus.summary.campaignEnded,
        eligible: campaignStatus.eligible,
        eligibilityStatus: campaignStatus.eligibilityStatus,
        eligibilityMessage: campaignStatus.eligibilityMessage,
      })
    : null;
  const eligible = Boolean(eligibility?.isEligible);
  return (
    <section className="finale">
      <div className="finale-visual">
        <div className="gift">
          <span>FA</span>
          <i />
          <b />
        </div>
      </div>
      <div className="finale-copy">
        <p className="eyebrow">
          {currentCampaign.isBeta ? "Bêta · 13–14 novembre 2026" : "Décembre 2026 · Résultat final"}
        </p>
        <h2>
          Found Aura
          <br />
          <em>Final Result</em>
        </h2>
        <p>« Votre parcours personnel dans le dressing secret Found Aura. »</p>
        <small>Votre résultat est calculé uniquement depuis les validations serveur.</small>
        <div className={`final-status ${eligible ? "yes" : ""}`}>
          <span>
            {eligible ? "✓" : summaryAvailable ? campaignStatus?.summary.score : totalDays}
          </span>
          <p>
            {eligibility?.state === "PENDING"
              ? summaryAvailable
                ? `Participation terminée : ${campaignStatus?.summary.collectedCount}/${totalDays} collecté(s). Éligibilité en attente.`
                : `Collectez vos ${totalDays} Auras pour le grand tirage. ${
                    campaignStatus?.collectedDays.length || 0
                  }/${totalDays} validée(s). Éligibilité en attente.`
              : eligible
                ? "Félicitations ! Votre participation est éligible au grand tirage au sort."
                : summaryAvailable
                  ? `Participation terminée : ${campaignStatus?.summary.collectedCount}/${totalDays} collecté(s), ${campaignStatus?.summary.missedCount} manqué(s). ${eligibility?.label}.`
                  : `Collectez vos ${totalDays} Auras pour le grand tirage. ${
                      campaignStatus?.collectedDays.length || 0
                    }/${totalDays} validée(s). Éligibilité au tirage en attente de confirmation.`}
          </p>
        </div>
        {summaryAvailable && campaignStatus && (
          <div className="completion-flow">
            <CompletionCard campaignStatus={campaignStatus} />
            <div className="giveaway-instructions">
              <strong>
                Résultat final officiel : {campaignStatus.summary.collectedCount}/{totalDays}{" "}
                jour(s) collecté(s), {campaignStatus.summary.missedCount} manqué(s).
              </strong>
              <p>Préparez une capture de votre ticket officiel Found Aura pour le tirage.</p>
              <small>{eligibility?.label} · un seul code officiel par participante.</small>
            </div>
            <div className="completion-actions">
              <button className="primary light" onClick={onCapture}>
                Préparer ma capture <span>↗</span>
              </button>
              <a
                className="facebook-button"
                href={FACEBOOK_OFFICIAL_POST_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Partager sur Facebook <span>↗</span>
              </a>
            </div>
            <p className="facebook-placeholder">
              Publication officielle Found Aura · Postez votre capture en commentaire pour le tirage
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function DemoControls({
  active,
  setActive,
  day,
  setDay,
  completed,
  setCompleted,
  missed,
  setMissed,
  onReset,
}: {
  active: boolean;
  setActive: (b: boolean) => void;
  day: number;
  setDay: (n: number) => void;
  completed: Set<number>;
  setCompleted: (s: Set<number>) => void;
  missed: Set<number>;
  setMissed: (s: Set<number>) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const completeToDay = () => setCompleted(new Set(Array.from({ length: day }, (_, i) => i + 1)));
  const markMissed = () => {
    const next = new Set(missed);
    next.add(Math.max(1, day - 1));
    setMissed(next);
  };
  return (
    <aside className={`demo ${open ? "open" : ""}`}>
      <button className="demo-trigger" onClick={() => setOpen(!open)}>
        <i /> Mode démo
      </button>
      {open && (
        <div className="demo-panel">
          <div>
            <span>Outil de présentation</span>
            <button onClick={() => setOpen(false)}>×</button>
          </div>
          <p>Simulation locale — ne représente pas une validation serveur.</p>
          <label className="publish">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
            Autoriser l’aperçu libre des portes
          </label>
          <label>
            Date simulée <strong>{day} décembre 2026</strong>
            <input
              type="range"
              min="1"
              max="24"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
          </label>
          <div className="demo-actions">
            <button onClick={completeToDay}>Valider jusqu’ici</button>
            <button onClick={markMissed}>Marquer la veille manquée</button>
            <button
              onClick={() => {
                setDay(24);
                setCompleted(new Set(days.map((d) => d.day)));
              }}
            >
              Aperçu éligible
            </button>
            <button onClick={onReset}>Réinitialiser</button>
          </div>
          <small>
            {completed.size} collectée(s) · {missed.size} manquée(s)
          </small>
        </div>
      )}
    </aside>
  );
}

function BetaCampaign({
  active,
  status,
  statusLoading,
  statusError,
  onClose,
  onRegistered,
  onLogout,
}: {
  active: boolean;
  status: CampaignStatus | null;
  statusLoading: boolean;
  statusError: string;
  onClose: () => void;
  onRegistered: (status: CampaignStatus, recoveryToken: string) => void;
  onLogout: () => Promise<void>;
}) {
  const [subview, setSubview] = useState<
    "register" | "conflict" | "lookup" | "lost-link" | "request-sent"
  >("register");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [assistedName, setAssistedName] = useState("");
  const [assistedContact, setAssistedContact] = useState("");
  const [assistedExplanation, setAssistedExplanation] = useState("");
  const [assistedNotice, setAssistedNotice] = useState("");
  const [conflictNotice, setConflictNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!active) {
    if (subview === "conflict") {
      return (
        <Modal onClose={onClose} label="Vérification Found Aura">
          <div className="form-head">
            <p className="eyebrow dark">Vérification de compte</p>
            <h2>
              Accès
              <br />
              <em>sécurisé</em>
            </h2>
            <p>Protection de votre historique de participation.</p>
          </div>
          <div className="conflict-notice">
            <p>
              {conflictNotice ||
                "Si ces coordonnées sont déjà associées à une participation, aucun nouveau compte n’a été créé afin de protéger votre historique. Utilisez votre lien privé de récupération ou l’assistance Found Aura."}
            </p>
          </div>
          <div className="registration">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setError("");
                setSubview("lookup");
              }}
            >
              J’ai mon lien privé <span>↗</span>
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setAssistedName(fullName);
                setAssistedContact(contact);
                setSubview("lost-link");
              }}
            >
              J’ai perdu mon lien privé
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setSubview("register");
              }}
            >
              ← Modifier mes coordonnées
            </button>
          </div>
        </Modal>
      );
    }

    if (subview === "lookup") {
      return (
        <Modal onClose={onClose} label="Retrouver mon accès">
          <div className="form-head">
            <p className="eyebrow dark">Accès participant</p>
            <h2>
              Retrouver mon
              <br />
              <em>accès</em>
            </h2>
            <p>Saisissez votre lien privé ou jeton secret pour restaurer votre session.</p>
          </div>
          <form
            className="registration"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                let token = recoveryInput.trim();
                try {
                  const url = new URL(token);
                  const q = url.searchParams.get("recovery");
                  if (q) token = q;
                } catch {
                  // bare token
                }
                if (token.length < 20) {
                  throw new Error("Veuillez saisir un lien ou un jeton de récupération valide.");
                }
                const result = await recoverParticipant(token);
                onRegistered(result.status, token);
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "Jeton de récupération invalide.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Lien secret ou jeton de récupération
              <input
                required
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="Collez ici votre lien privé ou jeton"
              />
            </label>
            <button className="primary" disabled={busy || !recoveryInput.trim()}>
              {busy ? "Restauration…" : "Restaurer ma progression"} <span>↗</span>
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setAssistedName(fullName);
                setAssistedContact(contact);
                setSubview("lost-link");
              }}
            >
              J’ai perdu mon lien privé
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setSubview("register");
              }}
            >
              ← Retour à l’inscription
            </button>
            {error && <p className="fine-print">{error}</p>}
          </form>
        </Modal>
      );
    }

    if (subview === "lost-link") {
      return (
        <Modal onClose={onClose} label="Récupération assistée">
          <div className="form-head">
            <p className="eyebrow dark">Assistance Found Aura</p>
            <h2>
              Récupération
              <br />
              <em>assistée</em>
            </h2>
            <p>
              Vous avez égaré votre lien privé ? Déposez une demande auprès de l’équipe Found Aura.
            </p>
          </div>
          <form
            className="registration"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const res = await requestAssistedRecovery({
                  fullName: assistedName,
                  contact: assistedContact,
                  explanation: assistedExplanation,
                });
                setAssistedNotice(res.message);
                setSubview("request-sent");
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Impossible d'enregistrer votre demande.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nom complet
              <input
                required
                minLength={2}
                maxLength={120}
                value={assistedName}
                onChange={(e) => setAssistedName(e.target.value)}
                placeholder="Votre nom d'inscription"
              />
            </label>
            <label>
              Coordonnées de l’inscription (e-mail ou téléphone)
              <input
                required
                minLength={3}
                maxLength={254}
                value={assistedContact}
                onChange={(e) => setAssistedContact(e.target.value)}
                placeholder="vous@exemple.com ou +261"
              />
            </label>
            <label>
              Précisions ou explications <small>Optionnel</small>
              <textarea
                maxLength={1000}
                rows={3}
                value={assistedExplanation}
                onChange={(e) => setAssistedExplanation(e.target.value)}
                placeholder="Ex. : participation sur téléphone mais onglet fermé..."
                style={{
                  background: "transparent",
                  borderBottom: "1px solid #b6afa4",
                  display: "block",
                  fontFamily: "var(--serif)",
                  fontSize: "16px",
                  marginTop: "7px",
                  outline: "none",
                  padding: "7px 0",
                  resize: "vertical",
                  width: "100%",
                }}
              />
            </label>
            <button
              className="primary"
              disabled={busy || !assistedName.trim() || !assistedContact.trim()}
            >
              {busy ? "Envoi…" : "Envoyer ma demande"} <span>↗</span>
            </button>
            <p className="fine-print">
              Un nom et un e-mail non vérifié ne suffisent pas à restituer un accès automatiquement.
              Votre demande sera examinée par l’équipe Found Aura.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setSubview("register");
              }}
            >
              ← Retour à l’inscription
            </button>
            {error && <p className="fine-print">{error}</p>}
          </form>
        </Modal>
      );
    }

    if (subview === "request-sent") {
      return (
        <Modal onClose={onClose} label="Demande transmise">
          <div className="form-head">
            <p className="eyebrow dark">Demande enregistrée</p>
            <h2>
              Demande
              <br />
              <em>transmise</em>
            </h2>
            <p>Notre équipe examine les demandes manuellement.</p>
          </div>
          <div className="conflict-notice">
            <p>{assistedNotice}</p>
          </div>
          <div className="registration">
            <p className="fine-print">
              Aucune donnée privée n’est exposée sans vérification. Si votre participation est
              confirmée, un nouveau lien privé vous sera transmis.
            </p>
            <button className="primary" onClick={onClose}>
              Fermer <span>↗</span>
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError("");
                setSubview("register");
              }}
            >
              Retour à l’invitation
            </button>
          </div>
        </Modal>
      );
    }

    // Default: subview === "register"
    return (
      <Modal onClose={onClose} label="Inscription Found Aura">
        <div className="form-head">
          <p className="eyebrow dark">Votre invitation</p>
          <h2>
            Rejoignez le
            <br />
            <em>Dressing Secret</em>
          </h2>
          <p>Une inscription légère, sans mot de passe. Gardez ensuite votre lien privé.</p>
        </div>
        <form
          className="registration"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await registerParticipant({
                fullName,
                contact,
                accepted,
                marketingConsent,
              });
              if (result.recoveryRequired) {
                setConflictNotice(result.message);
                setSubview("conflict");
                return;
              }
              onRegistered(result.status, result.recoveryToken);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "L’inscription a échoué.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nom complet
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Votre nom"
            />
          </label>
          <label>
            E-mail ou téléphone <small>Optionnel · non vérifié</small>
            <input
              maxLength={254}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="vous@exemple.com ou +261"
            />
          </label>
          <label className="check">
            <input
              required
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>J’accepte le règlement de la campagne et la notice de confidentialité.</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
            />
            <span>Je souhaite recevoir les nouvelles Found Aura. Optionnel.</span>
          </label>
          <button className="primary" disabled={busy || !fullName.trim() || !accepted}>
            {busy ? "Inscription…" : "Entrer dans le dressing"} <span>↗</span>
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setError("");
              setRecoveryInput("");
              setSubview("lookup");
            }}
          >
            J’ai déjà participé — retrouver mon accès
          </button>
          <p className="fine-print">
            Votre contact est facultatif et n’est pas vérifié. Un lien privé vous permettra de
            récupérer votre progression.
          </p>
          {(statusError || error) && <p className="fine-print">{statusError || error}</p>}
        </form>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} label="Ma participation" wide>
      <div className="rules">
        <p className="eyebrow dark">Found Aura · heure de Madagascar</p>
        <h2>
          Votre <em>participation</em>
        </h2>
        {statusLoading && !status ? (
          <p>Chargement de votre participation…</p>
        ) : status ? (
          <div className="rules-note">
            <h3>{status.participant.fullName}</h3>
            <p>
              Code public : <strong>{status.participant.participationCode}</strong>
            </p>
            <p>
              {status.summary.collectedCount}/{status.campaign.totalDays} collecté(s) ·{" "}
              {status.summary.missedCount} manqué(s)
            </p>
          </div>
        ) : null}
        {statusError && <p className="fine-print">{statusError}</p>}
        <button className="primary" onClick={onClose}>
          Accéder au dressing <span>↗</span>
        </button>
        <button className="text-button" onClick={() => void onLogout()}>
          Quitter cet appareil
        </button>
      </div>
    </Modal>
  );
}

function RecoveryNotice({
  privateLink,
  onClose,
  onRotate,
}: {
  privateLink: string;
  onClose: () => void;
  onRotate: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal onClose={onClose} label="Votre lien privé de récupération">
      <div className="form-head">
        <p className="eyebrow dark">Accès privé</p>
        <h2>
          Gardez votre
          <br />
          <em>lien secret</em>
        </h2>
        <p>
          Ce lien restaure votre progression sur un autre appareil. Ne le publiez jamais et ne
          l’incluez pas dans une capture.
        </p>
      </div>
      <div className="registration">
        <label>
          Lien privé de récupération
          <input readOnly value={privateLink} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <button
          className="primary"
          onClick={async () => {
            await navigator.clipboard.writeText(privateLink);
            setCopied(true);
          }}
        >
          {copied ? "Lien copié" : "Copier le lien privé"} <span>↗</span>
        </button>
        <button className="text-button" onClick={() => void onRotate()}>
          Révoquer ce lien et en créer un nouveau
        </button>
        <p className="fine-print">
          Sans cette session ni ce lien privé, la récupération de votre participation ne peut pas
          être garantie.
        </p>
      </div>
    </Modal>
  );
}

function BetaAdmin({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"participants" | "recovery" | "duplicates">("participants");
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignId>(campaignId);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [eligibilityStats, setEligibilityStats] = useState<CampaignEligibilitySummary | null>(null);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequestRecord[]>([]);
  const [recoveryFilter, setRecoveryFilter] = useState<string>("all");
  const [duplicateGroups, setDuplicateGroups] = useState<SuspectedDuplicateGroup[]>([]);
  const [mergeHistory, setMergeHistory] = useState<MergeBackupRecord[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [mergeNotes, setMergeNotes] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [generatedTokens, setGeneratedTokens] = useState<Record<string, string>>({});
  const [minimumScoreInput, setMinimumScoreInput] = useState("");
  const [facebookDeadlineInput, setFacebookDeadlineInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => setAccessToken(data.session?.access_token || ""));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setAccessToken(session?.access_token || ""),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const loadData = async (token: string, targetCampaign: CampaignId = selectedCampaign) => {
    setBusy(true);
    setError("");
    try {
      const [partRes, recRes, dupRes, eligRes] = await Promise.all([
        getAdminParticipants(token, targetCampaign),
        getAdminRecoveryRequests(token, undefined, targetCampaign),
        getAdminDuplicates(token, targetCampaign),
        getAdminCampaignEligibility(token, targetCampaign).catch(() => null),
      ]);
      setParticipants(partRes.participants);
      setRecoveryRequests(recRes.requests);
      setDuplicateGroups(dupRes.duplicateGroups);
      setMergeHistory(dupRes.mergeHistory);
      setEligibilityStats(eligRes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Accès administrateur refusé.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!eligibilityStats) return;
    setMinimumScoreInput(
      eligibilityStats.minimumScore === null ? "" : String(eligibilityStats.minimumScore),
    );
    setFacebookDeadlineInput(
      formatMadagascarDateTimeInput(eligibilityStats.facebookSubmissionDeadline),
    );
  }, [eligibilityStats]);

  useEffect(() => {
    if (!accessToken) return;
    void loadData(accessToken, selectedCampaign);
  }, [accessToken, selectedCampaign]);

  const handleReviewRequest = async (requestId: string, action: "approve" | "reject") => {
    const notes = reviewNotes[requestId] || "";
    if (notes.trim().length < 3) {
      setError("Veuillez saisir une justification pour cette décision.");
      return;
    }
    setBusy(true);
    setError("");
    setActionSuccess("");
    try {
      const result = await reviewAdminRecoveryRequest(accessToken, requestId, {
        action,
        adminNotes: notes,
      });
      if (action === "approve" && result.recoveryLink) {
        setGeneratedTokens((prev) => ({ ...prev, [requestId]: result.recoveryLink! }));
        setActionSuccess("Nouveau lien privé émis avec succès. L'ancien lien a été révoqué.");
      } else {
        setActionSuccess("La demande de récupération a été refusée.");
      }
      await loadData(accessToken, selectedCampaign);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le traitement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async (groupKey: string, primaryId: string, duplicateId: string) => {
    const notes = mergeNotes[groupKey] || "";
    if (notes.trim().length < 5) {
      setError(
        "Une justification administrative détaillée est obligatoire pour valider la fusion.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setActionSuccess("");
    try {
      const result = await mergeAdminParticipants(accessToken, {
        primaryParticipantId: primaryId,
        duplicateParticipantId: duplicateId,
        adminNotes: notes,
      });
      setActionSuccess(
        `Fusion effectuée avec succès ! Code conservé : ${result.retainedPublicCode}. Code archivé : ${result.retiredPublicCode}. Référence sauvegarde : ${result.backupId.slice(0, 8)}.`,
      );
      await loadData(accessToken, selectedCampaign);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La fusion a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const saveDrawSettings = async () => {
    const minimumScore = Number(minimumScoreInput);
    const campaignTotal = CAMPAIGNS[selectedCampaign].totalDays;
    if (!Number.isInteger(minimumScore) || minimumScore < 0 || minimumScore > campaignTotal) {
      setError(`Saisissez un score minimum entier entre 0 et ${campaignTotal}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateAdminDrawSettings(accessToken, {
        campaign: selectedCampaign,
        minimumScore,
        facebookSubmissionDeadline: facebookDeadlineInput || null,
      });
      setActionSuccess("Configuration officielle du tirage enregistrée.");
      await loadData(accessToken, selectedCampaign);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Impossible d’enregistrer la configuration.",
      );
    } finally {
      setBusy(false);
    }
  };

  const filteredRequests = recoveryRequests.filter((req) => {
    if (recoveryFilter === "pending") return req.status === "pending";
    if (recoveryFilter === "approved") return req.status === "approved";
    if (recoveryFilter === "rejected") return req.status === "rejected";
    return true;
  });

  return (
    <Modal onClose={onClose} label="Administration Found Aura" wide>
      <div className="rules">
        <p className="eyebrow dark">Found Aura · accès restreint</p>
        <h2>
          Gestion <em>campagne</em>
        </h2>
        {!accessToken ? (
          <form
            className="registration"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                if (signInError) throw signInError;
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "La connexion a échoué.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail administrateur
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Mot de passe
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="primary" disabled={busy || !email || !password}>
              {busy ? "Connexion…" : "Se connecter"} <span>↗</span>
            </button>
          </form>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: "10px",
                margin: "16px 0 8px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span className="admin-subtext" style={{ fontWeight: 600 }}>
                Campagne sélectionnée :
              </span>
              <button
                type="button"
                className={`admin-tab-btn ${selectedCampaign === "december-2026" ? "active" : ""}`}
                onClick={() => setSelectedCampaign("december-2026")}
                style={{ border: "1px solid #cec6ba", borderRadius: "2px" }}
              >
                The Secret Wardrobe (Décembre 2026 · Officiel)
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${selectedCampaign === "november-2026-beta" ? "active" : ""}`}
                onClick={() => setSelectedCampaign("november-2026-beta")}
                style={{ border: "1px solid #cec6ba", borderRadius: "2px" }}
              >
                Bêta 2026 (Novembre · Archivée)
              </button>
            </div>

            <div className="admin-nav">
              <button
                type="button"
                className={`admin-tab-btn ${tab === "participants" ? "active" : ""}`}
                onClick={() => setTab("participants")}
              >
                Participations ({participants.length})
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${tab === "recovery" ? "active" : ""}`}
                onClick={() => setTab("recovery")}
              >
                File de récupération (
                {recoveryRequests.filter((r) => r.status === "pending").length})
              </button>
              <button
                type="button"
                className={`admin-tab-btn ${tab === "duplicates" ? "active" : ""}`}
                onClick={() => setTab("duplicates")}
              >
                Doublons & fusions ({duplicateGroups.length})
              </button>
            </div>

            {actionSuccess && (
              <div className="conflict-notice" style={{ borderLeftColor: "var(--sage)" }}>
                <p>{actionSuccess}</p>
              </div>
            )}

            {busy && <p>Chargement des données administratives…</p>}

            {tab === "participants" && !busy && (
              <>
                {eligibilityStats && (
                  <div
                    style={{
                      background: "#ede6dc",
                      borderLeft: "3px solid var(--sage)",
                      padding: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{ fontFamily: "var(--serif)", fontSize: "18px", marginBottom: "6px" }}
                    >
                      Grand Tirage · Règle du seuil dégressif
                    </h3>
                    <p className="admin-subtext">
                      Statut : <strong>{eligibilityStats.statusText}</strong>
                    </p>
                    <p className="admin-subtext">
                      Meilleur score enregistré :{" "}
                      <strong>{eligibilityStats.highestScore}/24</strong> · Participants éligibles :{" "}
                      <strong>{eligibilityStats.eligibleCount}</strong> sur{" "}
                      {eligibilityStats.totalParticipants} au total.
                    </p>
                    <p className="admin-subtext">
                      Minimum officiel :{" "}
                      <strong>
                        {eligibilityStats.minimumScore === null
                          ? "Non configuré — décision organisateur requise"
                          : `${eligibilityStats.minimumScore}/24`}
                      </strong>
                      {" · "}Seuil final :{" "}
                      <strong>
                        {eligibilityStats.threshold === null
                          ? "Non confirmé"
                          : `${eligibilityStats.threshold}/24`}
                      </strong>
                    </p>
                    <p className="admin-subtext">
                      Date limite Facebook :{" "}
                      <strong>
                        {eligibilityStats.facebookSubmissionDeadline
                          ? `${formatMadagascarDateTimeDisplay(
                              eligibilityStats.facebookSubmissionDeadline,
                            )} (heure de Madagascar)`
                          : "Non configurée"}
                      </strong>
                      {" · "}Commentaires vérifiés dans le pool final :{" "}
                      <strong>{eligibilityStats.facebookVerifiedCount}</strong>
                    </p>
                    {eligibilityStats.finalVerifiedDrawPool.length > 0 && (
                      <p className="admin-subtext">
                        Codes du pool vérifié :{" "}
                        <strong>{eligibilityStats.finalVerifiedDrawPool.join(", ")}</strong>
                      </p>
                    )}
                    <div className="admin-form-group" style={{ marginTop: "12px" }}>
                      <label className="admin-subtext">
                        Configuration officielle réservée à l’administrateur (avant lancement)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={CAMPAIGNS[selectedCampaign].totalDays}
                        value={minimumScoreInput}
                        placeholder={
                          eligibilityStats.minimumScore === null
                            ? "Score minimum officiel (requis)"
                            : `Score minimum actuel : ${eligibilityStats.minimumScore}`
                        }
                        onChange={(event) => setMinimumScoreInput(event.target.value)}
                      />
                      <input
                        type="datetime-local"
                        value={facebookDeadlineInput}
                        onChange={(event) => setFacebookDeadlineInput(event.target.value)}
                        aria-label="Date limite Facebook"
                      />
                      <p className="fine-print" style={{ textAlign: "left", margin: 0 }}>
                        Heure de Madagascar (Indian/Antananarivo, UTC+03:00)
                      </p>
                      <button
                        type="button"
                        className="primary admin-btn-sm"
                        onClick={() => void saveDrawSettings()}
                      >
                        Publier la configuration du tirage <span>↗</span>
                      </button>
                    </div>
                    <p className="fine-print" style={{ textAlign: "left", marginTop: "6px" }}>
                      Avant la clôture du 25 décembre 00:00, l'éligibilité définitive est en
                      attente. Aucun gagnant n'est désigné automatiquement : le tirage est effectué
                      séparément parmi les participants validés au meilleur score.
                    </p>
                  </div>
                )}
                <p>{participants.length} participante(s) active(s).</p>
                <div className="rules-note">
                  {participants.map((participant) => {
                    const eligibility = resolveEligibilityDisplay({
                      campaignId: participant.campaign,
                      madagascarDate: eligibilityStats?.currentDate || getMadagascarDate(),
                      campaignEnded: eligibilityStats?.campaignEnded,
                      eligible: participant.eligible,
                      eligibilityStatus: participant.eligibilityStatus,
                      drawStatus: eligibilityStats?.status,
                    });
                    return (
                      <p key={participant.participantId}>
                        <strong>{participant.fullName}</strong> ·{" "}
                        <span className="admin-code">{participant.participationCode}</span>
                        <br />
                        <span className="admin-subtext">
                          Inscription :{" "}
                          {new Date(participant.registeredAt).toLocaleDateString("fr-FR")} · Contact
                          : {participant.contact || "aucun"} · {participant.collectedDays.length}{" "}
                          collecté(s) · {participant.missedDays.length} manqué(s) ·{" "}
                          {participant.score} · {eligibility.label}
                        </span>
                      </p>
                    );
                  })}
                </div>
                <button
                  className="primary"
                  onClick={() => void downloadAdminCsv(accessToken, selectedCampaign)}
                >
                  Exporter le CSV <span>↗</span>
                </button>
              </>
            )}

            {tab === "recovery" && !busy && (
              <div>
                <div className="admin-btn-row" style={{ marginBottom: "16px" }}>
                  <button
                    type="button"
                    className={`admin-tab-btn ${recoveryFilter === "all" ? "active" : ""}`}
                    onClick={() => setRecoveryFilter("all")}
                  >
                    Toutes ({recoveryRequests.length})
                  </button>
                  <button
                    type="button"
                    className={`admin-tab-btn ${recoveryFilter === "pending" ? "active" : ""}`}
                    onClick={() => setRecoveryFilter("pending")}
                  >
                    En attente ({recoveryRequests.filter((r) => r.status === "pending").length})
                  </button>
                  <button
                    type="button"
                    className={`admin-tab-btn ${recoveryFilter === "approved" ? "active" : ""}`}
                    onClick={() => setRecoveryFilter("approved")}
                  >
                    Validées ({recoveryRequests.filter((r) => r.status === "approved").length})
                  </button>
                  <button
                    type="button"
                    className={`admin-tab-btn ${recoveryFilter === "rejected" ? "active" : ""}`}
                    onClick={() => setRecoveryFilter("rejected")}
                  >
                    Refusées ({recoveryRequests.filter((r) => r.status === "rejected").length})
                  </button>
                </div>

                {filteredRequests.length === 0 ? (
                  <p className="admin-subtext">Aucune demande dans cette catégorie.</p>
                ) : (
                  filteredRequests.map((req) => (
                    <div key={req.id} className="admin-item-card">
                      <div className="admin-item-header">
                        <h3 className="admin-item-title">{req.fullName}</h3>
                        <span className={`admin-badge ${req.status}`}>
                          {req.status === "pending"
                            ? "En attente"
                            : req.status === "approved"
                              ? "Validée"
                              : "Refusée"}
                        </span>
                      </div>
                      <p className="admin-subtext">
                        Coordonnées déclarées : <strong>{req.contact}</strong> · Reçue le :{" "}
                        {new Date(req.createdAt).toLocaleString("fr-FR")}
                      </p>
                      {req.explanation && (
                        <p className="admin-subtext">
                          <em>Explication :</em> « {req.explanation} »
                        </p>
                      )}

                      {req.matchedParticipant ? (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.03)",
                            padding: "10px 14px",
                            borderRadius: "2px",
                          }}
                        >
                          <p className="admin-subtext">
                            Compte identifié : <strong>{req.matchedParticipant.fullName}</strong> ·
                            Code public :{" "}
                            <span className="admin-code">{req.matchedParticipant.publicCode}</span>{" "}
                            · Score : {req.matchedParticipant.score}
                          </p>
                        </div>
                      ) : (
                        <p className="admin-subtext" style={{ color: "#8c5b36" }}>
                          Aucun compte participant n’a été automatiquement relié à ce contact.
                        </p>
                      )}

                      {req.status === "pending" && (
                        <div className="admin-form-group">
                          <label className="admin-subtext">
                            Justification administrative & vérification d'identité (obligatoire) :
                          </label>
                          <textarea
                            rows={2}
                            value={reviewNotes[req.id] || ""}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            placeholder="Ex. : Identité confirmée via échange téléphonique ou boutique le..."
                          />
                          <div className="admin-btn-row">
                            <button
                              type="button"
                              className="primary admin-btn-sm"
                              disabled={!req.matchedParticipantId}
                              onClick={() => void handleReviewRequest(req.id, "approve")}
                            >
                              Valider & émettre un nouveau lien privé <span>↗</span>
                            </button>
                            <button
                              type="button"
                              className="admin-btn-danger"
                              onClick={() => void handleReviewRequest(req.id, "reject")}
                            >
                              Refuser la demande
                            </button>
                          </div>
                        </div>
                      )}

                      {req.status === "approved" && (
                        <div>
                          <p className="admin-subtext">
                            Validée par l'administrateur. Notes : {req.adminNotes || "—"}
                          </p>
                          {generatedTokens[req.id] && (
                            <div style={{ marginTop: "8px" }}>
                              <label className="admin-subtext">
                                Nouveau lien privé (à transmettre au participant) :
                              </label>
                              <input
                                readOnly
                                value={generatedTokens[req.id]}
                                onFocus={(e) => e.currentTarget.select()}
                                style={{ width: "100%", marginTop: "4px" }}
                              />
                              <button
                                type="button"
                                className="text-button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(generatedTokens[req.id]);
                                  setActionSuccess("Lien copié dans le presse-papier !");
                                }}
                              >
                                Copier le lien de récupération
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {req.status === "rejected" && (
                        <p className="admin-subtext">
                          Demande refusée. Motif : {req.adminNotes || "—"}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "duplicates" && !busy && (
              <div>
                <p className="admin-subtext" style={{ marginBottom: "16px" }}>
                  Contrôle des doublons au sein de la campagne ({selectedCampaign}). Les
                  enregistrements de la bêta et de décembre restent strictement séparés.
                </p>

                {duplicateGroups.length === 0 ? (
                  <p className="admin-subtext">Aucun doublon actif suspecté pour cette campagne.</p>
                ) : (
                  duplicateGroups.map((group) => {
                    const targetId = selectedTargets[group.key] || group.participants[0]?.id;
                    const duplicateParticipant = group.participants.find((p) => p.id !== targetId);
                    return (
                      <div key={group.key} className="admin-item-card">
                        <div className="admin-item-header">
                          <h3 className="admin-item-title">
                            Contact commun : {group.normalizedContact}
                          </h3>
                          <span className="admin-badge pending">
                            {group.participants.length} comptes détectés
                          </span>
                        </div>

                        <div className="rules-note" style={{ margin: "10px 0" }}>
                          {group.participants.map((p) => (
                            <p key={p.id}>
                              <strong>{p.fullName}</strong> · Code :{" "}
                              <span className="admin-code">{p.publicCode}</span>
                              <br />
                              <span className="admin-subtext">
                                ID : {p.id} · Enregistré le :{" "}
                                {new Date(p.registeredAt).toLocaleDateString("fr-FR")} · Score :{" "}
                                {p.score} · Jours :{" "}
                                {p.collectedDays.length > 0 ? p.collectedDays.join(", ") : "aucun"}
                              </span>
                            </p>
                          ))}
                        </div>

                        <div
                          style={{
                            background: "rgba(0,0,0,0.03)",
                            padding: "10px 14px",
                            borderRadius: "2px",
                          }}
                        >
                          <p className="admin-subtext">
                            Jours collectés en commun :{" "}
                            <strong>
                              {group.overlappingDays.length > 0
                                ? group.overlappingDays.join(", ")
                                : "Aucun chevauchement"}
                            </strong>
                          </p>
                          <p className="admin-subtext">
                            Score résultant après fusion :{" "}
                            <strong>{group.combinedUniqueDays.length} jour(s)</strong>
                          </p>
                          {group.eligibilityImpact.afterEligible &&
                            !group.eligibilityImpact.beforeEligible && (
                              <p
                                className="admin-subtext"
                                style={{ color: "#8c5b36", fontWeight: "bold" }}
                              >
                                Attention : la fusion rend ce participant éligible au tirage final !
                                Assurez-vous que les collectes proviennent bien de la même personne.
                              </p>
                            )}
                        </div>

                        {group.participants.length === 2 && duplicateParticipant && (
                          <div className="admin-form-group">
                            <label className="admin-subtext">
                              Compte principal à CONSERVER (conservera son code public et son
                              identifiant) :
                            </label>
                            <select
                              value={targetId}
                              onChange={(e) =>
                                setSelectedTargets((prev) => ({
                                  ...prev,
                                  [group.key]: e.target.value,
                                }))
                              }
                            >
                              {group.participants.map((p) => (
                                <option key={p.id} value={p.id}>
                                  Conserver {p.fullName} (Code : {p.publicCode} · Score : {p.score})
                                </option>
                              ))}
                            </select>

                            <label className="admin-subtext" style={{ marginTop: "6px" }}>
                              Justification et preuve de propriété (obligatoire) :
                            </label>
                            <textarea
                              rows={2}
                              value={mergeNotes[group.key] || ""}
                              onChange={(e) =>
                                setMergeNotes((prev) => ({
                                  ...prev,
                                  [group.key]: e.target.value,
                                }))
                              }
                              placeholder="Ex. : Propriétaire unique vérifié lors de sa visite boutique..."
                            />

                            <div className="admin-btn-row">
                              <button
                                type="button"
                                className="primary admin-btn-sm"
                                onClick={() =>
                                  void handleMerge(group.key, targetId, duplicateParticipant.id)
                                }
                              >
                                Confirmer la fusion contrôlée <span>↗</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {mergeHistory.length > 0 && (
                  <div style={{ marginTop: "32px" }}>
                    <h3
                      style={{ fontFamily: "var(--serif)", fontSize: "20px", marginBottom: "12px" }}
                    >
                      Historique des fusions & sauvegardes
                    </h3>
                    {mergeHistory.map((backup) => (
                      <div
                        key={backup.id}
                        style={{
                          background: "#f4f1e9",
                          borderLeft: "2px solid var(--sage)",
                          padding: "12px 16px",
                          marginBottom: "10px",
                        }}
                      >
                        <p className="admin-subtext">
                          Code conservé :{" "}
                          <span className="admin-code">{backup.retainedPublicCode}</span> · Code
                          archivé : <span className="admin-code">{backup.retiredPublicCode}</span>
                        </p>
                        <p className="admin-subtext">
                          Fusionné le : {new Date(backup.mergedAt).toLocaleString("fr-FR")} ·
                          Sauvegarde : {backup.id.slice(0, 8)} · Notes : {backup.adminNotes}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {error && <p className="fine-print">{error}</p>}
      </div>
    </Modal>
  );
}

const fallbackCampaignDays = currentCampaign.days;

function enterWardrobe() {
  window.requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>("#wardrobe-heading");
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => heading?.focus({ preventScroll: true }), 500);
  });
}

function RecoveryFailureModal({
  failure,
  onRetry,
  onAssistedRecovery,
  onManualInput,
  onRegister,
  onClose,
}: {
  failure: { isNetworkError: boolean; message: string; recoveryToken: string };
  onRetry: () => void;
  onAssistedRecovery: () => void;
  onManualInput: () => void;
  onRegister: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} label="Récupération d'accès">
      <div className="form-head">
        <p className="eyebrow dark">Accès Found Aura</p>
        <h2>
          {failure.isNetworkError ? "Connexion" : "Lien non"}
          <br />
          <em>{failure.isNetworkError ? "interrompue" : "reconnu"}</em>
        </h2>
        <p>
          {failure.isNetworkError
            ? "Le serveur n’a pas pu être joint pour valider votre lien privé."
            : "Ce lien de récupération est invalide, a expiré ou a été révoqué."}
        </p>
      </div>
      <div className="conflict-notice">
        <p>{failure.message}</p>
      </div>
      <div className="registration">
        {failure.isNetworkError ? (
          <button className="primary" onClick={onRetry}>
            Réessayer la récupération <span>↗</span>
          </button>
        ) : (
          <>
            <button className="primary" onClick={onAssistedRecovery}>
              J’ai perdu mon lien privé <span>↗</span>
            </button>
            <button type="button" className="text-button" onClick={onManualInput}>
              J’ai déjà participé — retrouver mon accès
            </button>
            <button type="button" className="text-button" onClick={onRegister}>
              Nouvelle inscription
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function App() {
  const [registration, setRegistration] = useState(false);
  const [rules, setRules] = useState(false);
  const [passport, setPassport] = useState(false);
  const [reveal, setReveal] = useState<WardrobeDay | null>(null);
  const [modalReturnContext, setModalReturnContext] = useState<string | null>(null);
  const [day, setDay] = useState(8);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [demoMode, setDemoMode] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [participantSession, setParticipantSession] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>("AUTH_LOADING");
  const [authError, setAuthError] = useState("");
  const [recoveryFailure, setRecoveryFailure] = useState<{
    isNetworkError: boolean;
    message: string;
    recoveryToken: string;
  } | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [madagascarDate, setMadagascarDate] = useState(getMadagascarDate);
  const [privateRecoveryLink, setPrivateRecoveryLink] = useState("");
  const [specialView, setSpecialView] = useState<"beta" | "admin" | null>(() =>
    window.location.hash === "#admin" ? "admin" : window.location.hash === "#beta" ? "beta" : null,
  );

  const campaignDays = campaignStatus?.campaign.days || fallbackCampaignDays;
  const completedDaysSet = new Set<number>(
    campaignStatus?.collectedDays
      .map((date) => campaignDays.indexOf(date) + 1)
      .filter((value) => value > 0) || [],
  );
  const missedDaysSet = new Set<number>(
    campaignStatus?.missedDays
      .map((date) => campaignDays.indexOf(date) + 1)
      .filter((value) => value > 0) || [],
  );
  const calendarDate = campaignStatus?.madagascarDate || madagascarDate;
  const availableIndex = campaignDays.indexOf(calendarDate);
  const availableDay = availableIndex >= 0 ? availableIndex + 1 : null;
  const currentCollected = reveal ? completedDaysSet.has(reveal.day) : false;

  useEffect(() => {
    const updateDate = () => setMadagascarDate(getMadagascarDate());
    const timer = window.setInterval(updateDate, 60_000);
    window.addEventListener("focus", updateDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateDate);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setAuthState("AUTH_LOADING");
      setStatusLoading(true);
      setAuthError("");
      setRecoveryFailure(null);

      try {
        // 1. Detect recovery parameters before normal navigation
        const recoveryToken = recoveryTokenFromUrl();
        if (recoveryToken) {
          const urlParams = new URL(window.location.href).searchParams;
          const requestedCampaign = urlParams.get("campaign");
          const targetCampaign: CampaignId =
            requestedCampaign === "november-2026-beta" || requestedCampaign === "december-2026"
              ? requestedCampaign
              : campaignId;

          try {
            // 3. Send the private token to server recovery endpoint & wait for response
            const recovered = await recoverParticipant(recoveryToken, targetCampaign);
            if (!active) return;

            if (
              !recovered.participantSession ||
              !recovered.status?.participant?.participationCode
            ) {
              throw new Error("Données de participation incomplètes reçues du serveur.");
            }

            // 5. Establish and persist the restored participant session
            setParticipantSession(recovered.participantSession);
            setCampaignStatus(recovered.status);
            setAuthState("AUTHENTICATED");
            setRegistration(false);
            setRecoveryFailure(null);
            // Do NOT open the private link modal during recovery
            setPrivateRecoveryLink("");

            // 8. Only then remove the recovery token from the visible URL
            cleanRecoveryUrl();

            // 9. Automatically navigate to the wardrobe
            enterWardrobe();
            return;
          } catch (reason) {
            if (!active) return;
            const isNetworkError =
              reason instanceof TypeError ||
              (reason instanceof Error &&
                (reason.message.includes("Failed to fetch") ||
                  reason.message.includes("NetworkError") ||
                  reason.message.includes("fetch")));

            const displayMessage = isNetworkError
              ? "Impossible de joindre le serveur. Vérifiez votre connexion internet."
              : "Ce lien secret de récupération est invalide, a expiré ou a été révoqué.";

            setAuthState("AUTH_ERROR");
            setAuthError(displayMessage);
            setRecoveryFailure({
              isNetworkError,
              message: displayMessage,
              recoveryToken,
            });

            if (!isNetworkError) {
              cleanRecoveryUrl();
            }
            return;
          }
        }

        // Normal session restoration from local storage
        const stored = getStoredParticipantSession();
        if (!stored) {
          const legacy = await supabase.auth.getSession();
          if (legacy.data.session) {
            try {
              const migrated = await migrateLegacyParticipant(legacy.data.session.access_token);
              if (!active) return;
              setParticipantSession(migrated.participantSession);
              setCampaignStatus(migrated.status);
              setAuthState("AUTHENTICATED");
              await supabase.auth.signOut();
              return;
            } catch {
              // No matching legacy participant; continue with lightweight registration.
            }
          }
          setAuthState("UNAUTHENTICATED");
          return;
        }
        setParticipantSession(stored);
        const status = await getCampaignStatus();
        if (!active) return;
        setCampaignStatus(status);
        setAuthState("AUTHENTICATED");
        setRegistration(false);
      } catch (reason) {
        if (!active) return;
        clearParticipantSession();
        setParticipantSession(null);
        setCampaignStatus(null);
        setAuthState("UNAUTHENTICATED");
      } finally {
        if (active) setStatusLoading(false);
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateRoute = () =>
      setSpecialView(
        window.location.hash === "#beta"
          ? "beta"
          : window.location.hash === "#admin"
            ? "admin"
            : null,
      );
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  const retryStatus = async () => {
    if (!participantSession) {
      setRegistration(true);
      return;
    }
    setStatusLoading(true);
    setStatusError("");
    try {
      setCampaignStatus(await getCampaignStatus());
      setAuthState("AUTHENTICATED");
    } catch (reason) {
      setStatusError(
        reason instanceof Error ? reason.message : "Impossible de charger votre participation.",
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const collect = async () => {
    if (!reveal || !participantSession || reveal.day !== availableDay || currentCollected)
      throw new Error("Cette Aura n’est pas disponible aujourd’hui.");
    setStatusError("");
    try {
      setCampaignStatus(await collectCampaignDay());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "La validation a échoué.";
      setStatusError(message);
      throw new Error(message);
    }
  };

  const revealButtonState: RevealButtonState = (() => {
    if (!reveal) return "UNAVAILABLE";
    if (currentCollected) return "COMPLETED";
    if (authState === "AUTH_LOADING") return "AUTH_LOADING";
    if (authState !== "AUTHENTICATED" || !participantSession) return "UNAUTHENTICATED";
    if (statusLoading) return "AUTH_LOADING";
    if (statusError || !campaignStatus) return "BACKEND_ERROR";
    const revealDate = campaignDays[reveal.day - 1] || "";
    if (revealDate && campaignStatus.missedDays.includes(revealDate)) return "MISSED";
    if (reveal.day === availableDay) return "ELIGIBLE";
    if (revealDate && revealDate > campaignStatus.madagascarDate) return "FUTURE";
    return "UNAVAILABLE";
  })();

  const revealMessage =
    revealButtonState === "AUTH_LOADING"
      ? "Votre session participante est en cours de restauration."
      : revealButtonState === "UNAUTHENTICATED"
        ? authError || "Inscrivez-vous ou utilisez votre lien privé de récupération."
        : revealButtonState === "BACKEND_ERROR"
          ? statusError || "Le statut de votre participation n’a pas pu être chargé."
          : revealButtonState === "FUTURE"
            ? "Cette porte ouvrira à sa date officielle, heure de Madagascar."
            : revealButtonState === "MISSED"
              ? "Cette journée est passée sans validation. Son contenu reste consultable, mais la collecte est définitivement fermée."
              : revealButtonState === "UNAVAILABLE"
                ? "Cette Aura n’est pas disponible à la date actuelle à Madagascar."
                : "";

  const closeSpecialView = () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setSpecialView(null);
  };

  const closeAllModals = () => {
    setPassport(false);
    setRules(false);
    setRegistration(false);
    setReveal(null);
    setPrivateRecoveryLink("");
    setRecoveryFailure(null);
  };

  const handleRegistered = (status: CampaignStatus, recoveryToken: string) => {
    setParticipantSession(getStoredParticipantSession());
    setCampaignStatus(status);
    setAuthState("AUTHENTICATED");
    closeAllModals();
    setSpecialView(null);
    setPrivateRecoveryLink(recoveryLink(recoveryToken));
    enterWardrobe();
  };

  return (
    <main>
      <Header
        onPassport={() => {
          if (authState === "AUTHENTICATED" && participantSession) {
            closeAllModals();
            setPassport(true);
            if (!campaignStatus) {
              void retryStatus();
            }
          } else {
            closeAllModals();
            setRegistration(true);
          }
        }}
        onRules={() => {
          closeAllModals();
          setRules(true);
        }}
      />
      <Hero
        onEnter={() => {
          if (authState === "AUTHENTICATED" && participantSession) {
            enterWardrobe();
          } else {
            closeAllModals();
            setRegistration(true);
          }
        }}
        onRules={() => {
          closeAllModals();
          setRules(true);
        }}
      />
      <Wardrobe
        availableDay={availableDay}
        completed={completedDaysSet}
        missed={missedDaysSet}
        onOpen={(d) => {
          closeAllModals();
          setReveal(d);
        }}
        loading={authState === "AUTH_LOADING" || statusLoading}
        error={authError || statusError}
        campaignDays={campaignDays}
      />
      <section className="privilege">
        <p className="eyebrow dark">Votre rendez-vous Found Aura</p>
        <h2>
          Des pièces qui ont une histoire.
          <br />
          <em>Une Aura qui devient la vôtre.</em>
        </h2>
        <div>
          <span>01</span>
          <p>
            <strong>Découvrir</strong>Une surprise éditoriale chaque jour
          </p>
          <span>02</span>
          <p>
            <strong>Composer</strong>Des jeux et conseils pour votre style
          </p>
          <span>03</span>
          <p>
            <strong>Accéder</strong>À des privilèges shopping exclusifs
          </p>
        </div>
      </section>
      <Finale campaignStatus={campaignStatus} onCapture={() => setCaptureMode(true)} />
      <footer>
        <div className="brand footer-brand">
          <BrandLogo />
        </div>
        <p>
          Curated second-hand fashion
          <br />
          Antananarivo, Madagascar
        </p>
        <button onClick={() => setRules(true)}>Règlement & confidentialité</button>
        <span>© 2026 · Avec MaintyBox</span>
      </footer>
      {isDevelopmentPreview() && (
        <DemoControls
          active={demoMode}
          setActive={setDemoMode}
          day={day}
          setDay={setDay}
          completed={completed}
          setCompleted={setCompleted}
          missed={missed}
          setMissed={setMissed}
          onReset={() => {
            setCompleted(new Set());
            setMissed(new Set());
          }}
        />
      )}
      {captureMode && campaignStatus?.summary.campaignEnded && (
        <CaptureView campaignStatus={campaignStatus} onClose={() => setCaptureMode(false)} />
      )}
      {recoveryFailure && (
        <RecoveryFailureModal
          failure={recoveryFailure}
          onRetry={() => {
            setRecoveryFailure(null);
            void initialize();
          }}
          onAssistedRecovery={() => {
            setRecoveryFailure(null);
            setRegistration(true);
          }}
          onManualInput={() => {
            setRecoveryFailure(null);
            setRegistration(true);
          }}
          onRegister={() => {
            setRecoveryFailure(null);
            setRegistration(true);
          }}
          onClose={() => setRecoveryFailure(null)}
        />
      )}
      {privateRecoveryLink && (
        <RecoveryNotice
          privateLink={privateRecoveryLink}
          onClose={() => {
            setPrivateRecoveryLink("");
            if (modalReturnContext === "passport") {
              setModalReturnContext(null);
              setPassport(true);
            }
          }}
          onRotate={async () => {
            const result = await rotateRecoveryToken();
            setPrivateRecoveryLink(recoveryLink(result.recoveryToken));
          }}
        />
      )}
      {registration && (
        <BetaCampaign
          active={authState === "AUTHENTICATED"}
          status={campaignStatus}
          statusLoading={statusLoading}
          statusError={authError || statusError}
          onClose={() => setRegistration(false)}
          onRegistered={handleRegistered}
          onLogout={async () => {
            await revokeParticipantSession();
            setParticipantSession(null);
            setCampaignStatus(null);
            setAuthState("UNAUTHENTICATED");
            setRegistration(false);
          }}
        />
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
      {passport && (
        <Passport
          campaignStatus={campaignStatus}
          loading={statusLoading && !campaignStatus}
          error={statusError}
          onClose={() => setPassport(false)}
          onRetry={retryStatus}
          onRecovery={async () => {
            setModalReturnContext("passport");
            setPassport(false);
            try {
              const result = await rotateRecoveryToken();
              setPrivateRecoveryLink(recoveryLink(result.recoveryToken));
            } catch (err) {
              setStatusError(
                err instanceof Error ? err.message : "Impossible de renouveler le lien.",
              );
              setPassport(true);
            }
          }}
          onSessionExpired={() => {
            closeAllModals();
            setRegistration(true);
          }}
        />
      )}
      {reveal && (
        <Reveal
          day={reveal}
          collected={currentCollected}
          buttonState={revealButtonState}
          unavailableMessage={revealMessage}
          onClose={() => setReveal(null)}
          onCollect={collect}
          onAuthenticate={() => {
            setReveal(null);
            setRegistration(true);
          }}
          onRetry={retryStatus}
        />
      )}
      {specialView === "beta" && (
        <BetaCampaign
          active={authState === "AUTHENTICATED"}
          status={campaignStatus}
          statusLoading={statusLoading}
          statusError={authError || statusError}
          onClose={closeSpecialView}
          onRegistered={handleRegistered}
          onLogout={async () => {
            await revokeParticipantSession();
            setParticipantSession(null);
            setCampaignStatus(null);
            setAuthState("UNAUTHENTICATED");
            closeSpecialView();
          }}
        />
      )}
      {specialView === "admin" && <BetaAdmin onClose={closeSpecialView} />}
    </main>
  );
}
