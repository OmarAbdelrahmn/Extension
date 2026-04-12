document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('openDashboard').addEventListener('click', function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });
});
