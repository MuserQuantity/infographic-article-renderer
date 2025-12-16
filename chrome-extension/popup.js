// 默认服务地址
const DEFAULT_SERVER_URL = 'https://infographic.muserquantity.cn';

// DOM 元素
const currentUrlEl = document.getElementById('currentUrl');
const analyzeBtnEl = document.getElementById('analyzeBtn');
const settingsToggleEl = document.getElementById('settingsToggle');
const settingsContentEl = document.getElementById('settingsContent');
const serverUrlEl = document.getElementById('serverUrl');
const saveBtnEl = document.getElementById('saveBtn');
const savedMsgEl = document.getElementById('savedMsg');
const translateCheckEl = document.getElementById('translateCheck');

let currentTabUrl = '';

// 初始化
async function init() {
  // 获取当前标签页 URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentTabUrl = tab.url;
      currentUrlEl.textContent = currentTabUrl;

      // 检查是否是可分析的 URL
      if (currentTabUrl.startsWith('chrome://') ||
          currentTabUrl.startsWith('chrome-extension://') ||
          currentTabUrl.startsWith('about:')) {
        currentUrlEl.textContent = '当前页面无法分析';
        analyzeBtnEl.disabled = true;
      }
    } else {
      currentUrlEl.textContent = '无法获取当前页面';
      analyzeBtnEl.disabled = true;
    }
  } catch (error) {
    currentUrlEl.textContent = '获取页面失败';
    analyzeBtnEl.disabled = true;
  }

  // 加载保存的设置
  const result = await chrome.storage.sync.get(['serverUrl', 'translateToChinese']);
  serverUrlEl.value = result.serverUrl || DEFAULT_SERVER_URL;
  translateCheckEl.checked = result.translateToChinese !== false; // 默认为 true
}

// 分析按钮点击
analyzeBtnEl.addEventListener('click', async () => {
  if (!currentTabUrl) return;

  const result = await chrome.storage.sync.get(['serverUrl']);
  const serverUrl = (result.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
  const translate = translateCheckEl.checked;

  // 保存翻译选项
  await chrome.storage.sync.set({ translateToChinese: translate });

  // 构建目标 URL
  const targetUrl = `${serverUrl}/?url=${encodeURIComponent(currentTabUrl)}`;

  // 在新标签页打开
  chrome.tabs.create({ url: targetUrl });

  // 关闭 popup
  window.close();
});

// 设置切换
settingsToggleEl.addEventListener('click', () => {
  settingsToggleEl.classList.toggle('open');
  settingsContentEl.classList.toggle('open');
});

// 保存设置
saveBtnEl.addEventListener('click', async () => {
  const serverUrl = serverUrlEl.value.trim() || DEFAULT_SERVER_URL;

  await chrome.storage.sync.set({ serverUrl });

  // 显示保存成功消息
  savedMsgEl.classList.add('show');
  setTimeout(() => {
    savedMsgEl.classList.remove('show');
  }, 2000);
});

// 初始化
init();
