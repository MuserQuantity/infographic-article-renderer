// 默认服务地址
const DEFAULT_SERVER_URL = 'https://infographic.muserquantity.cn';
const BILIBILI_VIDEO_PREFIX = 'https://www.bilibili.com/video/';
const BILIBILI_BVID_PATTERN = /\/video\/(BV[0-9A-Za-z]+)/;
const BILIBILI_AID_PATTERN = /\/video\/av(\d+)/i;
const BILIBILI_TASKS_KEY = 'bilibiliTasks';

// DOM 元素
const currentUrlEl = document.getElementById('currentUrl');
const analyzeBtnEl = document.getElementById('analyzeBtn');
const articlesBtnEl = document.getElementById('articlesBtn');
const statusEl = document.getElementById('statusMsg');
const settingsToggleEl = document.getElementById('settingsToggle');
const settingsContentEl = document.getElementById('settingsContent');
const serverUrlEl = document.getElementById('serverUrl');
const saveBtnEl = document.getElementById('saveBtn');
const savedMsgEl = document.getElementById('savedMsg');
const translateCheckEl = document.getElementById('translateCheck');
const serverLinkBtnEl = document.getElementById('serverLinkBtn');

let currentTabUrl = '';

function setStatus(message, type = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('error', 'success');
  if (type !== 'info') {
    statusEl.classList.add(type);
  }
}

function isBilibiliVideoUrl(url) {
  return url.startsWith(BILIBILI_VIDEO_PREFIX);
}

function extractBilibiliId(url) {
  const bvidMatch = url.match(BILIBILI_BVID_PATTERN);
  if (bvidMatch) {
    return { bvid: bvidMatch[1], aid: null };
  }
  const aidMatch = url.match(BILIBILI_AID_PATTERN);
  if (aidMatch) {
    return { bvid: null, aid: aidMatch[1] };
  }
  return { bvid: null, aid: null };
}

function getBilibiliPageParam(url) {
  try {
    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get('p'));
    return Number.isFinite(page) && page > 0 ? page : null;
  } catch (err) {
    return null;
  }
}

function buildBilibiliSourceUrl(url) {
  const { bvid, aid } = extractBilibiliId(url);
  if (!bvid && !aid) {
    return null;
  }
  const page = getBilibiliPageParam(url);
  const baseUrl = bvid
    ? `https://www.bilibili.com/video/${bvid}`
    : `https://www.bilibili.com/video/av${aid}`;
  if (page && page > 1) {
    return `${baseUrl}?p=${page}`;
  }
  return baseUrl;
}

function buildBilibiliCacheKey(url, translateToChinese) {
  const { bvid, aid } = extractBilibiliId(url);
  if (!bvid && !aid) {
    return null;
  }
  const page = getBilibiliPageParam(url);
  const pagePart = page ? `p${page}` : 'p1';
  const translatePart = translateToChinese ? 'zh' : 'raw';
  return `${bvid ? `bvid:${bvid}` : `aid:${aid}`}:${pagePart}:${translatePart}`;
}

async function getCachedBilibiliTaskId(cacheKey) {
  if (!cacheKey) return null;
  const result = await chrome.storage.local.get([BILIBILI_TASKS_KEY]);
  const cacheMap = result[BILIBILI_TASKS_KEY] || {};
  return cacheMap[cacheKey] || null;
}

async function setCachedBilibiliTaskId(cacheKey, taskId) {
  if (!cacheKey) return;
  const result = await chrome.storage.local.get([BILIBILI_TASKS_KEY]);
  const cacheMap = result[BILIBILI_TASKS_KEY] || {};
  cacheMap[cacheKey] = taskId;
  await chrome.storage.local.set({ [BILIBILI_TASKS_KEY]: cacheMap });
}

async function clearCachedBilibiliTaskId(cacheKey) {
  if (!cacheKey) return;
  const result = await chrome.storage.local.get([BILIBILI_TASKS_KEY]);
  const cacheMap = result[BILIBILI_TASKS_KEY] || {};
  if (cacheKey in cacheMap) {
    delete cacheMap[cacheKey];
    await chrome.storage.local.set({ [BILIBILI_TASKS_KEY]: cacheMap });
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }
  return response.json();
}

async function getBilibiliSubtitleText(videoUrl) {
  const { bvid, aid } = extractBilibiliId(videoUrl);
  if (!bvid && !aid) {
    throw new Error('未识别到 B 站视频 ID');
  }

  const pageParam = getBilibiliPageParam(videoUrl);
  const pagelistUrl = bvid
    ? `https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`
    : `https://api.bilibili.com/x/player/pagelist?aid=${aid}`;
  const pagelist = await fetchJson(pagelistUrl, { credentials: 'include' });

  if (pagelist.code !== 0 || !Array.isArray(pagelist.data) || pagelist.data.length === 0) {
    throw new Error('未找到视频分P信息');
  }

  let pageInfo = pagelist.data[0];
  if (pageParam) {
    pageInfo = pagelist.data.find((item) => item.page === pageParam) || pageInfo;
  }

  if (!pageInfo || !pageInfo.cid) {
    throw new Error('无法获取视频 CID');
  }

  const playerUrl = bvid
    ? `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${pageInfo.cid}`
    : `https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${pageInfo.cid}`;
  const playerInfo = await fetchJson(playerUrl, { credentials: 'include' });

  const subtitleList = playerInfo?.data?.subtitle?.list || playerInfo?.data?.subtitle?.subtitles || [];
  if (!Array.isArray(subtitleList) || subtitleList.length === 0) {
    throw new Error('该视频未提供字幕');
  }

  const preferredSubtitle = subtitleList.find((item) => {
    const lang = `${item.lan || ''}`.toLowerCase();
    const langDoc = `${item.lan_doc || ''}`;
    return lang.startsWith('zh') || langDoc.includes('中文');
  }) || subtitleList[0];

  let subtitleUrl = preferredSubtitle.subtitle_url || preferredSubtitle.subtitleUrl || '';
  if (!subtitleUrl) {
    throw new Error('字幕地址缺失');
  }
  if (subtitleUrl.startsWith('//')) {
    subtitleUrl = `https:${subtitleUrl}`;
  }

  const subtitleData = await fetchJson(subtitleUrl, { credentials: 'include' });
  const subtitleBody = subtitleData?.body || subtitleData?.data?.body || [];
  const lines = Array.isArray(subtitleBody)
    ? subtitleBody.map((item) => item.content).filter(Boolean)
    : [];

  if (lines.length === 0) {
    throw new Error('字幕内容为空');
  }

  const header = pageInfo.part ? `分P：${pageInfo.part}\n\n` : '';
  return `${header}${lines.join('\n')}`;
}

async function createTextTask(serverUrl, text, translateToChinese, sourceUrl) {
  const payload = { text, translate_to_chinese: translateToChinese };
  if (sourceUrl) {
    payload.source_url = sourceUrl;
  }
  const response = await fetch(`${serverUrl}/api/tasks/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`提交字幕失败: ${response.status}`);
  }

  const task = await response.json();
  if (!task || !task.id) {
    throw new Error('解析任务创建失败');
  }
  return task.id;
}

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
  setStatus('');

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

  if (isBilibiliVideoUrl(currentTabUrl)) {
    analyzeBtnEl.disabled = true;
    const cacheKey = buildBilibiliCacheKey(currentTabUrl, translate);
    const sourceUrl = buildBilibiliSourceUrl(currentTabUrl);
    const cachedTaskId = await getCachedBilibiliTaskId(cacheKey);
    if (cachedTaskId) {
      setStatus('检测到已解析记录，正在打开...');
      try {
        const task = await fetchJson(`${serverUrl}/api/tasks/${cachedTaskId}`);
        if (task && task.status !== 'failed') {
          const targetUrl = `${serverUrl}/?id=${encodeURIComponent(task.id)}`;
          chrome.tabs.create({ url: targetUrl });
          window.close();
          return;
        }
      } catch (error) {
        await clearCachedBilibiliTaskId(cacheKey);
      }
    }

    setStatus('检测到 B 站视频，正在提取字幕...');
    try {
      const subtitleText = await getBilibiliSubtitleText(currentTabUrl);
      setStatus('字幕提取完成，提交解析中...');
      const taskId = await createTextTask(
        serverUrl,
        `来源：Bilibili 字幕\n\n${subtitleText}`,
        translate,
        sourceUrl
      );
      await setCachedBilibiliTaskId(cacheKey, taskId);
      const targetUrl = `${serverUrl}/?id=${encodeURIComponent(taskId)}`;
      chrome.tabs.create({ url: targetUrl });
      window.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : '字幕获取失败';
      setStatus(message, 'error');
      analyzeBtnEl.disabled = false;
    }
    return;
  }

  const targetUrl = `${serverUrl}/?url=${encodeURIComponent(currentTabUrl)}`;
  chrome.tabs.create({ url: targetUrl });
  window.close();
});

// 文章库按钮点击
articlesBtnEl.addEventListener('click', async () => {
  const result = await chrome.storage.sync.get(['serverUrl']);
  const serverUrl = (result.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
  const targetUrl = `${serverUrl}/articles`;
  chrome.tabs.create({ url: targetUrl });
  window.close();
});

serverLinkBtnEl.addEventListener('click', async () => {
  const result = await chrome.storage.sync.get(['serverUrl']);
  const serverUrl = (result.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
  chrome.tabs.create({ url: serverUrl });
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
