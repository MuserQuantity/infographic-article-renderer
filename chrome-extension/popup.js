// 默认服务地址
const DEFAULT_SERVER_URL = 'https://infographic.muserquantity.cn';
const BILIBILI_VIDEO_PREFIX = 'https://www.bilibili.com/video/';
const BILIBILI_BVID_PATTERN = /\/video\/(BV[0-9A-Za-z]+)/;
const BILIBILI_AID_PATTERN = /\/video\/av(\d+)/i;
const BILIBILI_TASKS_KEY = 'bilibiliTasks';

// YouTube 常量
const YOUTUBE_VIDEO_PATTERN = /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_TASKS_KEY = 'youtubeTasks';

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

    if ((options.type === 'bilibili' || options.type === 'youtube') && options.metadata) {
      const meta = options.metadata;
      bodyHTML += '<div>';
      if (meta.title) {
        bodyHTML += `<div class="confirm-info"><strong>📹 标题:</strong> ${escapeHtml(meta.title)}</div>`;
      }
      if (meta.owner?.name) {
        const ownerLabel = options.type === 'youtube' ? '👤 频道:' : '👤 UP主:';
        bodyHTML += `<div class="confirm-info"><strong>${ownerLabel}</strong> ${escapeHtml(meta.owner.name)}</div>`;
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
      // YouTube 特有：字幕语言信息
      if (options.type === 'youtube' && meta.captionLanguage) {
        bodyHTML += `<div class="confirm-info"><strong>🗣️ 字幕语言:</strong> ${escapeHtml(meta.captionLanguage)}</div>`;
        if (Array.isArray(meta.availableCaptions) && meta.availableCaptions.length > 1) {
          bodyHTML += `<div class="confirm-info"><strong>📋 可用字幕:</strong> ${escapeHtml(meta.availableCaptions.join(', '))}</div>`;
        }
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

// ==================== YouTube 相关函数 ====================

function isYouTubeVideoUrl(url) {
  return YOUTUBE_VIDEO_PATTERN.test(url);
}

function extractYouTubeVideoId(url) {
  const match = url.match(YOUTUBE_VIDEO_PATTERN);
  return match ? match[1] : null;
}

function buildYouTubeSourceUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildYouTubeCacheKey(videoId, translateToChinese) {
  if (!videoId) return null;
  const translatePart = translateToChinese ? 'zh' : 'raw';
  return `yt:${videoId}:${translatePart}`;
}

async function getCachedYouTubeTaskId(cacheKey) {
  if (!cacheKey) return null;
  const result = await chrome.storage.local.get([YOUTUBE_TASKS_KEY]);
  const cacheMap = result[YOUTUBE_TASKS_KEY] || {};
  return cacheMap[cacheKey] || null;
}

async function setCachedYouTubeTaskId(cacheKey, taskId) {
  if (!cacheKey) return;
  const result = await chrome.storage.local.get([YOUTUBE_TASKS_KEY]);
  const cacheMap = result[YOUTUBE_TASKS_KEY] || {};
  cacheMap[cacheKey] = taskId;
  await chrome.storage.local.set({ [YOUTUBE_TASKS_KEY]: cacheMap });
}

async function clearCachedYouTubeTaskId(cacheKey) {
  if (!cacheKey) return;
  const result = await chrome.storage.local.get([YOUTUBE_TASKS_KEY]);
  const cacheMap = result[YOUTUBE_TASKS_KEY] || {};
  if (cacheKey in cacheMap) {
    delete cacheMap[cacheKey];
    await chrome.storage.local.set({ [YOUTUBE_TASKS_KEY]: cacheMap });
  }
}

/**
 * 从 YouTube 页面注入脚本提取视频元数据和字幕轨道信息。
 * YouTube 页面内嵌 ytInitialPlayerResponse，包含 captions.playerCaptionsTracklistRenderer.captionTracks。
 */
async function getYouTubePageInfo(tabId) {
  if (!tabId || !chrome?.scripting?.executeScript) {
    return null;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        // 尝试从页面全局变量获取 player response
        let playerResponse = null;

        // 方法1: ytInitialPlayerResponse（页面首次加载时存在）
        if (window.ytInitialPlayerResponse) {
          playerResponse = window.ytInitialPlayerResponse;
        }

        // 方法2: 从 ytplayer.config 获取
        if (!playerResponse && window.ytplayer?.config?.args?.raw_player_response) {
          playerResponse = window.ytplayer.config.args.raw_player_response;
        }

        // 方法3: 从 document 中的 script 标签解析
        if (!playerResponse) {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const text = script.textContent || '';
            const marker = 'ytInitialPlayerResponse = ';
            const idx = text.indexOf(marker);
            if (idx !== -1) {
              try {
                const jsonStr = text.substring(idx + marker.length);
                // 找到 JSON 对象的结尾
                let depth = 0;
                let end = 0;
                for (let i = 0; i < jsonStr.length; i++) {
                  if (jsonStr[i] === '{') depth++;
                  else if (jsonStr[i] === '}') {
                    depth--;
                    if (depth === 0) { end = i + 1; break; }
                  }
                }
                if (end > 0) {
                  playerResponse = JSON.parse(jsonStr.substring(0, end));
                }
              } catch (e) {
                // 解析失败，继续尝试
              }
              break;
            }
          }
        }

        if (!playerResponse) {
          return null;
        }

        const videoDetails = playerResponse.videoDetails || {};
        const captions = playerResponse.captions;
        const captionTracks = captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

        return {
          videoId: videoDetails.videoId || '',
          title: videoDetails.title || '',
          author: videoDetails.author || '',
          channelId: videoDetails.channelId || '',
          shortDescription: videoDetails.shortDescription || '',
          lengthSeconds: videoDetails.lengthSeconds || '0',
          viewCount: videoDetails.viewCount || '0',
          keywords: videoDetails.keywords || [],
          captionTracks: captionTracks.map(track => ({
            baseUrl: track.baseUrl || '',
            languageCode: track.languageCode || '',
            name: track.name?.simpleText || track.name?.runs?.[0]?.text || '',
            kind: track.kind || '',
            vssId: track.vssId || ''
          }))
        };
      }
    });
    return result || null;
  } catch (error) {
    return null;
  }
}

/**
 * 解析 YouTube timedtext XML 格式为纯文本行。
 * YouTube 字幕 API 返回的 XML 格式: <transcript><text start="0" dur="1.5">Hello</text>...</transcript>
 */
function parseTimedTextXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const textElements = doc.querySelectorAll('text');
  const lines = [];
  for (const el of textElements) {
    const content = el.textContent || '';
    // 解码 HTML 实体并清理
    const cleaned = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    if (cleaned) {
      lines.push(cleaned);
    }
  }
  return lines;
}

/**
 * 解析 YouTube JSON3 格式字幕为纯文本行。
 */
function parseJson3Captions(json3Data) {
  const events = json3Data?.events || [];
  const lines = [];
  for (const event of events) {
    if (!event.segs) continue;
    const text = event.segs.map(seg => seg.utf8 || '').join('').trim();
    if (text && text !== '\n') {
      lines.push(text);
    }
  }
  return lines;
}

/**
 * 获取 YouTube 视频字幕文本。
 * 1. 从页面注入获取字幕轨道 URL
 * 2. 优先选择中文字幕，其次英文，最后第一个可用
 * 3. 获取字幕内容并解析为文本
 */
async function getYouTubeSubtitleText(videoUrl, tabId) {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    throw new Error('未识别到 YouTube 视频 ID');
  }

  const pageInfo = await getYouTubePageInfo(tabId);
  if (!pageInfo) {
    throw new Error('无法获取 YouTube 页面信息，请确保页面已完全加载后重试');
  }

  const captionTracks = pageInfo.captionTracks || [];
  if (captionTracks.length === 0) {
    throw new Error('该视频没有可用字幕');
  }

  // 选择最佳字幕轨道：优先中文 > 英文 > 第一个
  const zhTrack = captionTracks.find(t => t.languageCode.startsWith('zh'));
  const enTrack = captionTracks.find(t => t.languageCode.startsWith('en'));
  const selectedTrack = zhTrack || enTrack || captionTracks[0];

  if (!selectedTrack.baseUrl) {
    throw new Error('字幕轨道地址缺失');
  }

  // 尝试用 JSON3 格式获取（更可靠），如果失败则用 XML
  let lines = [];
  try {
    const json3Url = selectedTrack.baseUrl + '&fmt=json3';
    const json3Response = await fetch(json3Url);
    if (json3Response.ok) {
      const json3Data = await json3Response.json();
      lines = parseJson3Captions(json3Data);
    }
  } catch (e) {
    // JSON3 失败，回退到 XML
  }

  if (lines.length === 0) {
    // 回退到 XML 格式
    const xmlResponse = await fetch(selectedTrack.baseUrl);
    if (!xmlResponse.ok) {
      throw new Error(`获取字幕失败: ${xmlResponse.status}`);
    }
    const xmlText = await xmlResponse.text();
    lines = parseTimedTextXml(xmlText);
  }

  if (lines.length === 0) {
    throw new Error('字幕内容为空');
  }

  const subtitleText = lines.join('\n');

  // 构建元数据（与 Bilibili 格式对齐，用于确认对话框）
  const metadata = {
    title: pageInfo.title,
    desc: pageInfo.shortDescription,
    owner: { name: pageInfo.author },
    tags: pageInfo.keywords.slice(0, 10),
    videoId: videoId,
    captionLanguage: selectedTrack.name || selectedTrack.languageCode,
    availableCaptions: captionTracks.map(t => t.name || t.languageCode)
  };

  return {
    metadata,
    subtitleText,
    getFullText: () => {
      let fullText = '';

      if (metadata.title) {
        fullText += `# ${metadata.title}\n\n`;
      }

      if (metadata.owner?.name) {
        fullText += `**频道**: ${metadata.owner.name}\n`;
      }

      if (metadata.captionLanguage) {
        fullText += `**字幕语言**: ${metadata.captionLanguage}\n`;
      }

      if (metadata.desc) {
        const descText = metadata.desc.length > 500 ? metadata.desc.substring(0, 500) + '...' : metadata.desc;
        fullText += `\n**视频简介**:\n${descText}\n`;
      }

      if (Array.isArray(metadata.tags) && metadata.tags.length > 0) {
        fullText += `\n**标签**: ${metadata.tags.join(', ')}\n`;
      }

      fullText += '\n---\n\n';
      fullText += `**字幕内容**:\n\n${subtitleText}`;

      return fullText;
    }
  };
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

  // YouTube 视频处理
  if (isYouTubeVideoUrl(currentTabUrl)) {
    analyzeBtnEl.disabled = true;
    const videoId = extractYouTubeVideoId(currentTabUrl);
    if (!videoId) {
      setStatus('无法识别 YouTube 视频 ID', 'error');
      analyzeBtnEl.disabled = false;
      return;
    }

    const cacheKey = buildYouTubeCacheKey(videoId, translate);
    const sourceUrl = buildYouTubeSourceUrl(videoId);

    // 检查缓存
    const cachedTaskId = await getCachedYouTubeTaskId(cacheKey);
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
        await clearCachedYouTubeTaskId(cacheKey);
      }
    }

    setStatus('检测到 YouTube 视频，正在提取字幕...');
    try {
      const subtitleData = await getYouTubeSubtitleText(currentTabUrl, currentTabId);
      analyzeBtnEl.disabled = false;

      // 显示自定义确认对话框
      const confirmed = await showConfirmDialog({
        type: 'youtube',
        title: '确认分析 YouTube 视频',
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
      await setCachedYouTubeTaskId(cacheKey, taskId);
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
