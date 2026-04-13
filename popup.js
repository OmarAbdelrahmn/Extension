document.addEventListener('DOMContentLoaded', function () {
  const openBtn = document.getElementById('openDashboard');
  const userNameInput = document.getElementById('userNameInput');
  const errorMessage = document.getElementById('errorMessage');

  openBtn.addEventListener('click', async function () {
    const userName = userNameInput.value.trim();
    if (!userName) {
      errorMessage.textContent = 'يرجى إدخال اسم المستخدم';
      errorMessage.style.display = 'block';
      return;
    }

    openBtn.disabled = true;
    openBtn.style.opacity = '0.5';
    errorMessage.style.display = 'none';

    try {
      const response = await fetch(`https://express-extension-manager.premiumasp.net/api/providers/validate/${encodeURIComponent(userName)}`);
      
      if (!response.ok) {
        console.error('API Error:', response.status, response.statusText);
        errorMessage.textContent = 'حصل خطأ في الخادم (' + response.status + ')';
        errorMessage.style.display = 'block';
        openBtn.disabled = false;
        openBtn.style.opacity = '1';
        return;
      }

      const data = await response.json();
      
      if (data.valid === false) {
        errorMessage.textContent = 'اسم المستخدم غير صالح';
        errorMessage.style.display = 'block';
        openBtn.disabled = false;
        openBtn.style.opacity = '1';
        return;
      }
      
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      window.close();
    } catch (e) {
      console.error('Fetch Exception:', e);
      errorMessage.textContent = 'خطأ في الاتصال بالخادم (تأكد من اتصالك)';
      errorMessage.style.display = 'block';
      openBtn.disabled = false;
      openBtn.style.opacity = '1';
    }
  });

  userNameInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      openBtn.click();
    }
  });
});
