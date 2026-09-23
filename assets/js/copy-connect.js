export function initCopyButtons() {
  const buttons = document.querySelectorAll(".copy-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const textToCopy = btn.getAttribute("data-copy");
      if (!textToCopy) return;

      let success = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          success = true;
        } catch (err) {
          success = false;
        }
      }

      if (!success) {
        // Fallback for environments where Clipboard API is restricted
        try {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.top = "0";
          textArea.style.left = "0";
          textArea.style.width = "2em";
          textArea.style.height = "2em";
          textArea.style.padding = "0";
          textArea.style.border = "none";
          textArea.style.outline = "none";
          textArea.style.boxShadow = "none";
          textArea.style.background = "transparent";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          success = document.execCommand("copy");
          document.body.removeChild(textArea);
        } catch (err) {
          success = false;
        }
      }

      if (success) {
        const textSpan = btn.querySelector(".btn-text");
        const originalText = textSpan ? textSpan.textContent : "Copy";
        btn.classList.add("is-copied");
        if (textSpan) textSpan.textContent = "Copied!";

        setTimeout(() => {
          btn.classList.remove("is-copied");
          if (textSpan) textSpan.textContent = originalText;
        }, 2000);
      }
    });
  });
}
