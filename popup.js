// Tab switcher logic
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    
    btn.classList.add("active");
    const targetId = btn.getAttribute("data-tab") + "Input";
    document.getElementById(targetId).classList.add("active");
  });
});

document.getElementById("sendButton").addEventListener("click", async () => {
  const message = document.getElementById("message").value;
  const delaySec = parseInt(document.getElementById("delayTime").value) || 5;
  const activeTab = document.querySelector(".tab-btn.active").getAttribute("data-tab");
  const log = document.getElementById("statusLog");

  let contacts = [];

  // Parse according to active selection option
  if (activeTab === "manual") {
    const raw = document.getElementById("manualNums").value;
    contacts = raw.split(",").map(n => n.trim()).filter(n => n.length > 0);
  } else if (activeTab === "bulk") {
    const raw = document.getElementById("bulkNums").value;
    contacts = raw.split("\n").map(n => n.trim()).filter(n => n.length > 0);
  } else if (activeTab === "csv") {
    const fileInput = document.getElementById("contactFile");
    if (fileInput.files.length > 0) {
      contacts = await parseCSV(fileInput.files[0]);
    }
  }

  if (contacts.length === 0) {
    alert("Please configure recipient numbers accurately.");
    return;
  }

  // Handle Attachment Conversion
  let attachment = null;
  const attachInput = document.getElementById("attachmentFile");
  if (attachInput.files.length > 0) {
    attachment = await fileToBase64(attachInput.files[0]);
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes("https://web.whatsapp.com")) {
    alert("Keep WhatsApp Web open as your active browser tab.");
    return;
  }

  log.innerText = `Starting loop for ${contacts.length} numbers...`;

  for (let i = 0; i < contacts.length; i++) {
    const phoneNumber = contacts[i];
    log.innerText = `Sending to ${phoneNumber} (${i + 1}/${contacts.length})`;

    await new Promise(resolve => setTimeout(resolve, i * delaySec * 1000));

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: automateWhatsApp,
        args: [message, phoneNumber, attachment]
      });
    } catch (err) {
      console.error(err);
    }
  }
  log.innerText = "All messages and attachments processed successfully.";
});

function parseCSV(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      resolve(lines);
    };
    reader.readAsText(file);
  });
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      base64: reader.result.split(",")[1],
      contentType: file.type,
      filename: file.name
    });
    reader.readAsDataURL(file);
  });
}

// Injected Core Automation Flow
async function automateWhatsApp(msg, phone, fileObj) {
  // 1. Direct deep-link routing context switch without reloading state
  window.location.href = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
  
  function waitForSelector(selector, timeout = 20000) {
    return new Promise((res, rej) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) { clearInterval(timer); res(el); }
        if (Date.now() - start > timeout) { clearInterval(timer); rej(); }
      }, 400);
    });
  }

  try {
    // 2. Locate main interactive text pane area
    const inputField = await waitForSelector('div[contenteditable="true"][data-tab="10"]');
    
    // 3. Process Attachment Layer if supplied
    if (fileObj) {
      const attachBtn = await waitForSelector('span[data-icon="plus"], div[title="Attach"]');
      attachBtn.click();

      // Convert dynamic blob architecture 
      const response = await fetch(`data:${fileObj.contentType};base64,${fileObj.base64}`);
      const blob = await response.blob();
      const file = new File([blob], fileObj.filename, { type: fileObj.contentType });

      // Find file hidden engine inputs inside page DOM
      const fileInputEl = document.querySelector('input[type="file"]');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputEl.files = dataTransfer.files;
      fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for attachment preview pane confirmation action button
      const mediaSendBtn = await waitForSelector('span[data-icon="send"], div[role="button"] span[data-icon="checkmark-medium"]');
      mediaSendBtn.click();
    } else {
      // 4. Default structural message send event trigger fallback
      const sendBtn = await waitForSelector('span[data-icon="send"]');
      sendBtn.click();
    }
  } catch(e) {
    console.log("Routing execution interrupted or contact matching timed out.");
  }
}