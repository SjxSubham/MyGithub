import { useState, useEffect } from "react";
import { IoClose, IoDownload } from "react-icons/io5";
import { MdInstallMobile, MdInstallDesktop } from "react-icons/md";
import { toast } from "react-hot-toast";

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    // Show prompt if not dismissed or dismissed more than 7 days ago
    const shouldShow =
      !standalone && (!dismissed || now - dismissedTime > sevenDays);

    if (shouldShow) {
      // For Android/Chrome
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowPrompt(true);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      // For iOS - show manual instructions after delay
      if (iOS && !standalone) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 5000);
        return () => clearTimeout(timer);
      }

      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt && !isIOS) {
      return;
    }

    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
        toast.success("App installed successfully!");
      } else {
        console.log("User dismissed the install prompt");
      }

      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    toast("You can install the app anytime from browser settings", {
      icon: "ℹ️",
    });
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg shadow-2xl border border-blue-500/30 overflow-hidden">
        {/* Header */}
        <div className="p-4 pb-0 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              {isIOS ? (
                <MdInstallMobile className="text-2xl text-white" />
              ) : (
                <MdInstallDesktop className="text-2xl text-white" />
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                Install MyGitHub
              </h3>
              <p className="text-blue-200 text-sm">Quick access anytime!</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-200 hover:text-white transition-colors p-1"
          >
            <IoClose className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isIOS ? (
            // iOS Instructions
            <div className="space-y-3 mb-4">
              <p className="text-blue-100 text-sm">
                Install this app on your iPhone:
              </p>
              <ol className="text-blue-200 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button (
                    <svg
                      className="inline w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" />
                    </svg>
                    ) at the bottom
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Select <strong>&quot;Add to Home Screen&quot;</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tap <strong>&quot;Add&quot;</strong> to install
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            // Android/Desktop
            <div className="mb-4">
              <p className="text-blue-100 text-sm mb-3">
                Get instant access with notifications and offline support:
              </p>
              <ul className="text-blue-200 text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Works offline</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Push notifications</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Quick launch from home screen</span>
                </li>
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isIOS && (
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-white hover:bg-gray-100 text-blue-900 font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <IoDownload className="text-lg" />
                Install Now
              </button>
            )}
            <button
              onClick={handleDismiss}
              className={`${
                isIOS ? "flex-1" : "px-4"
              } bg-blue-700/50 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors`}
            >
              {isIOS ? "Got it" : "Later"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
