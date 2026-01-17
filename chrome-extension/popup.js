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

// 确认对话框元素
const confirmOverlayEl = document.getElementById('confirmOverlay');
const confirmHeaderEl = document.getElementById('confirmHeader');
const confirmBodyEl = document.getElementById('confirmBody');
const confirmCancelEl = document.getElementById('confirmCancel');
const confirmOkEl = document.getElementById('confirmOk');

let currentTabUrl = '';
let currentTabId = null;
let confirmResolve = null;

function setStatus(message, type = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('error', 'success');
  if (type !== 'info') {
    statusEl.classList.add(type);
  }
}

// 显示自定义确认对话框
function showConfirmDialog(options) {
  return new Promise((resolve) => {
    confirmResolve = resolve;

    // 设置标题
    confirmHeaderEl.textContent = options.title || '确认分析';

    // 构建内容
    let bodyHTML = '';

    if (options.type === 'bilibili' && options.metadata) {
      const meta = options.metadata;
      bodyHTML += '<div>';
      if (meta.title) {
        bodyHTML += `<div class="confirm-info"><strong>📹 标题:</strong> ${escapeHtml(meta.title)}</div>`;
      }
      if (meta.owner?.name) {
        bodyHTML += `<div class="confirm-info"><strong>👤 UP主:</strong> ${escapeHtml(meta.owner.name)}</div>`;
      }
      if (meta.part) {
        bodyHTML += `<div class="confirm-info"><strong>📑 分P:</strong> ${escapeHtml(meta.part)}</div>`;
      }
      if (meta.desc) {
        const descPreview = meta.desc.length > 150 ? meta.desc.substring(0, 150) + '...' : meta.desc;
        bodyHTML += `<div class="confirm-info"><strong>📝 简介:</strong> ${escapeHtml(descPreview)}</div>`;
      }
      if (Array.isArray(meta.tags) && meta.tags.length > 0) {
        const tagsText = meta.tags.slice(0, 5).join(', ') + (meta.tags.length > 5 ? '...' : '');
        bodyHTML += `<div class="confirm-info"><strong>🏷️ 标签:</strong> ${escapeHtml(tagsText)}</div>`;
      }
      bodyHTML += `<div class="confirm-info"><strong>🌐 翻译:</strong> ${options.translate ? '是' : '否'}</div>`;
      bodyHTML += '</div>';

      // 字幕内容折叠区
      if (options.subtitleText) {
        bodyHTML += `
          <div class="confirm-subtitle-section">
            <div class="confirm-subtitle-toggle" id="subtitleToggle">
              <span>📄 字幕内容预览 (${options.subtitleText.split('\\n').length} 行)</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            <div class="confirm-subtitle-content" id="subtitleContent">
              <textarea class="confirm-subtitle-textarea" readonly>${escapeHtml(options.subtitleText)}</textarea>
            </div>
          </div>
        `;
      }
    } else {
      // 普通网页
      const urlPreview = options.url.length > 100 ? options.url.substring(0, 100) + '...' : options.url;
      bodyHTML += '<div>';
      bodyHTML += `<div class="confirm-info"><strong>🔗 URL:</strong> ${escapeHtml(urlPreview)}</div>`;
      bodyHTML += `<div class="confirm-info"><strong>🌐 翻译:</strong> ${options.translate ? '是' : '否'}</div>`;
      bodyHTML += '</div>';
    }

    confirmBodyEl.innerHTML = bodyHTML;

    // 字幕折叠功能
    const subtitleToggle = document.getElementById('subtitleToggle');
    const subtitleContent = document.getElementById('subtitleContent');
    if (subtitleToggle && subtitleContent) {
      subtitleToggle.addEventListener('click', () => {
        subtitleToggle.classList.toggle('open');
        subtitleContent.classList.toggle('show');
      });
    }

    // 显示对话框
    confirmOverlayEl.classList.add('show');
  });
}

// 关闭确认对话框
function closeConfirmDialog(result) {
  confirmOverlayEl.classList.remove('show');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

// HTML 转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 确认对话框按钮事件
confirmCancelEl.addEventListener('click', () => {
  closeConfirmDialog(false);
});

confirmOkEl.addEventListener('click', () => {
  closeConfirmDialog(true);
});

// 点击遮罩层关闭
confirmOverlayEl.addEventListener('click', (e) => {
  if (e.target === confirmOverlayEl) {
    closeConfirmDialog(false);
  }
});

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

function buildBilibiliSourceUrl(url, page) {
  const { bvid, aid } = extractBilibiliId(url);
  if (!bvid && !aid) {
    return null;
  }
  const finalPage = Number.isFinite(page) && page > 1 ? page : getBilibiliPageParam(url);
  const baseUrl = bvid
    ? `https://www.bilibili.com/video/${bvid}`
    : `https://www.bilibili.com/video/av${aid}`;
  if (finalPage && finalPage > 1) {
    return `${baseUrl}?p=${finalPage}`;
  }
  return baseUrl;
}

function buildBilibiliCacheKey(url, translateToChinese, page, cid) {
  const { bvid, aid } = extractBilibiliId(url);
  if (!bvid && !aid) {
    return null;
  }
  const pagePart = Number.isFinite(page) && page > 0 ? `p${page}` : 'p1';
  const cidPart = cid ? `cid:${cid}` : 'cid:unknown';
  const translatePart = translateToChinese ? 'zh' : 'raw';
  return `${bvid ? `bvid:${bvid}` : `aid:${aid}`}:${pagePart}:${cidPart}:${translatePart}`;
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

async function getBilibiliPageInfoFromPage(tabId) {
  if (!tabId || !chrome?.scripting?.executeScript) {
    return null;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const state = window.__INITIAL_STATE__;
        if (!state || !state.videoData) {
          return null;
        }
        const videoData = state.videoData;
        const pages = Array.isArray(videoData.pages) ? videoData.pages : [];
        const currentPage = Number(state.p) || 1;
        const pageInfo = pages.find((page) => page.page === currentPage) || pages[0];
        if (!pageInfo) {
          return null;
        }

        // 提取视频元数据
        const metadata = {
          aid: state.aid || videoData.aid,
          bvid: state.bvid || videoData.bvid,
          cid: pageInfo.cid,
          page: pageInfo.page,
          part: pageInfo.part || '',
          // 视频基本信息
          title: videoData.title || '',
          desc: videoData.desc || '',
          // UP主信息
          owner: videoData.owner ? {
            name: videoData.owner.name || '',
            mid: videoData.owner.mid || ''
          } : null,
          // 标签信息
          tags: Array.isArray(videoData.tag)
            ? videoData.tag.map(t => t.tag_name || t.name).filter(Boolean)
            : [],
          // 统计信息
          stat: videoData.stat ? {
            view: videoData.stat.view || 0,
            like: videoData.stat.like || 0,
            coin: videoData.stat.coin || 0,
            favorite: videoData.stat.favorite || 0,
            share: videoData.stat.share || 0
          } : null,
          // 发布时间
          pubdate: videoData.pubdate || videoData.ctime || 0
        };

        return metadata;
      }
    });
    return result || null;
  } catch (error) {
    return null;
  }
}

async function getBilibiliSubtitleText(videoUrl, tabId, injectedInfo) {
  const { bvid, aid } = extractBilibiliId(videoUrl);
  if (!bvid && !aid) {
    throw new Error('未识别到 B 站视频 ID');
  }

  const pageInfoFromPage = injectedInfo || await getBilibiliPageInfoFromPage(tabId);
  if (!pageInfoFromPage?.cid) {
    throw new Error('无法获取页面分P信息，请刷新页面后重试');
  }

  const pageInfo = {
    cid: pageInfoFromPage.cid,
    page: pageInfoFromPage.page || 1,
    part: pageInfoFromPage.part || ''
  };
  const resolvedBvid = pageInfoFromPage.bvid || bvid;
  const resolvedAid = pageInfoFromPage.aid || aid;

  if (!resolvedBvid && !resolvedAid) {
    throw new Error('未识别到 B 站视频 ID');
  }

  const playerUrl = resolvedBvid
    ? `https://api.bilibili.com/x/player/v2?bvid=${resolvedBvid}&cid=${pageInfo.cid}`
    : `https://api.bilibili.com/x/player/v2?aid=${resolvedAid}&cid=${pageInfo.cid}`;
  const playerInfo = await fetchJson(playerUrl, { credentials: 'include' });

  const playerCid = playerInfo?.data?.cid;
  if (playerCid && `${playerCid}` !== `${pageInfo.cid}`) {
    throw new Error('字幕与当前分P不匹配，请刷新页面后重试');
  }

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

  // 返回元数据和字幕文本，用于确认对话框显示和最终提交
  const subtitleText = lines.join('\n');
  const metadata = pageInfoFromPage;

  return {
    metadata,
    subtitleText,
    // 构建包含完整元数据的文本用于提交
    getFullText: () => {
      let fullText = '';

      // 添加视频标题
      if (metadata.title) {
        fullText += `# ${metadata.title}\n\n`;
      }

      // 添加分P信息（如果有）
      if (metadata.part) {
        fullText += `## 分P：${metadata.part}\n\n`;
      }

      // 添加UP主信息
      if (metadata.owner?.name) {
        fullText += `**UP主**: ${metadata.owner.name}\n`;
      }

      // 添加视频简介
      if (metadata.desc) {
        fullText += `\n**视频简介**:\n${metadata.desc}\n`;
      }

      // 添加标签
      if (Array.isArray(metadata.tags) && metadata.tags.length > 0) {
        fullText += `\n**标签**: ${metadata.tags.join(', ')}\n`;
      }

      // 添加分隔线
      fullText += '\n---\n\n';

      // 添加字幕内容
      fullText += `**字幕内容**:\n\n${subtitleText}`;

      return fullText;
    }
  };
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
      currentTabId = tab.id ?? null;
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
    const injectedInfo = await getBilibiliPageInfoFromPage(currentTabId);
    if (!injectedInfo?.cid) {
      setStatus('无法获取页面分P信息，请刷新页面后重试', 'error');
      analyzeBtnEl.disabled = false;
      return;
    }

    const cacheKey = buildBilibiliCacheKey(currentTabUrl, translate, injectedInfo.page, injectedInfo.cid);
    const sourceUrl = buildBilibiliSourceUrl(currentTabUrl, injectedInfo.page);

    // 检查缓存
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
      const subtitleData = await getBilibiliSubtitleText(currentTabUrl, currentTabId, injectedInfo);
      analyzeBtnEl.disabled = false;

      // 显示自定义确认对话框
      const confirmed = await showConfirmDialog({
        type: 'bilibili',
        title: '确认分析 B 站视频',
        metadata: subtitleData.metadata,
        subtitleText: subtitleData.subtitleText,
        translate
      });

      if (!confirmed) {
        setStatus('已取消');
        return;
      }

      analyzeBtnEl.disabled = true;
      setStatus('提交解析中...');
      const taskId = await createTextTask(
        serverUrl,
        subtitleData.getFullText(),
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

  // 普通网页的确认
  const confirmed = await showConfirmDialog({
    type: 'normal',
    title: '确认分析网页',
    url: currentTabUrl,
    translate
  });

  if (!confirmed) {
    setStatus('已取消');
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
