/**
 * dsh-bili-scroll 到 QQ 转发 - NapCat 插件
 *
 * 接收 dsh-bili-scroll 在评论艾特发送成功 / 私信发送成功后 POST 过来的事件，
 * 转发到配置的多个 QQ 群和多个 QQ 私聊。
 *
 * 路由: POST /plugin/napcat-plugin-dsh-bili-forward/api/forward
 * 认证: 可选 x-dsh-bili-token
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DEFAULT_CONFIG = {
  enabled: true,
  groupIds: "",
  privateIds: "",
  forwardComments: true,
  forwardDms: true,
  forwardBriefs: true,
  includeLink: true,
  prefix: "【B站】",
  template: "{prefix} {kind}\\n{text}\\n{url}",
  token: "",
  atSign: "",
};

let config = { ...DEFAULT_CONFIG };
let ctx = null;
export let plugin_config_ui = [];
const seen = new Map();

function sanitizeConfig(raw) {
  const c = { ...DEFAULT_CONFIG };
  if (!raw || typeof raw !== "object") return c;
  for (const k of ["enabled", "forwardComments", "forwardDms", "forwardBriefs", "includeLink"]) {
    if (typeof raw[k] === "boolean") c[k] = raw[k];
  }
  for (const k of ["groupIds", "privateIds", "prefix", "template", "token", "atSign"]) {
    if (typeof raw[k] === "string") c[k] = raw[k];
  }
  return c;
}

function loadConfig(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8").replace(/^\uFEFF/, "");
      config = sanitizeConfig(JSON.parse(raw));
    }
  } catch (e) {
    ctx && ctx.logger.warn("[dsh-bili-forward] 配置读取失败，用默认值: " + e.message);
  }
}

function saveConfig(configPath) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    ctx && ctx.logger.error("[dsh-bili-forward] 配置保存失败: " + e.message);
  }
}

function parseIds(raw) {
  return [...new Set(String(raw || "").split(/[\s,，;；]+/).map(s => s.trim()).filter(Boolean))];
}

function render(template, vars) {
  const t = String(template || "").replace(/\\n/g, "\n");
  return t.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== "" ? String(vars[k]) : "")).trim();
}



function kindOf(event) {
  if (event === "comment_sent") return "评论艾特";
  if (event === "dm_sent") return "私信";
  if (event === "brief_ready") return "AIGC 日报";
  return "B站消息";
}

function dedupeKey(body) {
  const text = String(body.text || (Array.isArray(body.parts) ? body.parts.join("\n") : ""));
  return [body.event || "", body.date || "", body.bvid || "", body.rpid || "", body.receiverUid || "",
    crypto.createHash("sha1").update(text).digest("hex")].join("|");
}

function buildMessage(body) {
  const kind = kindOf(body.event);
  const vars = {
    prefix: config.prefix,
    kind,
    text: String(body.text || ""),
    url: config.includeLink ? String(body.url || "") : "",
    bvid: String(body.bvid || ""),
    uid: String(body.receiverUid || ""),
  };
  let msg = render(config.template, vars);
  if (!msg) {
    msg = [config.prefix, kind, vars.text, vars.url].filter(Boolean).join("\n");
  }
  if (config.atSign && String(body.event || "") !== "brief_ready") msg = "[CQ:at,qq=" + config.atSign + "] " + msg;
  return msg;
}

async function sendOne(targetType, targetId, message) {
  const params = { message, message_type: targetType };
  if (targetType === "group") params.group_id = String(targetId);
  else params.user_id = String(targetId);
  await ctx.actions.call("send_msg", params, ctx.adapterName, ctx.pluginManager.config);
}

async function forwardToQQ(body) {
  if (!config.enabled) return { ok: false, error: "插件未启用" };
  const event = String(body.event || "");
  if (event === "comment_sent" && !config.forwardComments) return { ok: true, skipped: "comments-off" };
  if (event === "dm_sent" && !config.forwardDms) return { ok: true, skipped: "dms-off" };
  if (event === "brief_ready" && !config.forwardBriefs) return { ok: true, skipped: "briefs-off" };
  if (event !== "comment_sent" && event !== "dm_sent" && event !== "brief_ready") return { ok: false, error: "未知事件: " + event };

  const groups = parseIds(config.groupIds);
  const privates = parseIds(config.privateIds);
  if (!groups.length && !privates.length) return { ok: false, error: "没有配置 QQ 群或 QQ 号" };

  const key = dedupeKey(body);
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < 10 * 60 * 1000) return { ok: true, skipped: "duplicate" };
  seen.set(key, now);
  if (seen.size > 1000) {
    for (const [k, t] of seen) if (now - t > 10 * 60 * 1000) seen.delete(k);
  }

  let messages = [];
  if (event === "brief_ready") {
    if (Array.isArray(body.parts)) messages = body.parts.map((p) => String(p || "").trim()).filter(Boolean);
    if (!messages.length && String(body.text || "").trim()) messages = [String(body.text).trim()];
  } else {
    messages = [buildMessage(body)].filter(Boolean);
  }
  if (!messages.length) return { ok: false, error: "消息正文为空" };

  let sent = 0;
  const failed = [];
  const sendTo = async (type, id) => {
    for (let i = 0; i < messages.length; i++) {
      try {
        await sendOne(type, id, messages[i]);
        sent++;
      } catch (e) {
        failed.push({ type, id, part: i + 1, error: String(e && e.message || e) });
      }
      if (i < messages.length - 1) await new Promise(r => setTimeout(r, 450));
    }
  };
  for (const id of groups) {
    await sendTo("group", id);
    await new Promise(r => setTimeout(r, 300));
  }
  for (const id of privates) {
    await sendTo("private", id);
    await new Promise(r => setTimeout(r, 300));
  }
  if (ctx) ctx.logger.info("[dsh-bili-forward] " + kindOf(event) + " 已转发 " + sent + " 条消息，失败 " + failed.length);
  return { ok: failed.length === 0, sent, failed, messages };
}



function buildConfigSchema(c) {
  return c.NapCatConfig.combine(
    c.NapCatConfig.html(`
      <div style="padding:16px;background:linear-gradient(135deg,#fb7299,#ff9db5);border-radius:12px;margin-bottom:20px;color:#fff;">
        <h3 style="margin:0 0 6px 0;font-size:18px;font-weight:600;">B站消息转发</h3>
        <p style="margin:0;font-size:13px;opacity:.9;">把 dsh-bili-scroll 发出的评论艾特和私信转发到 QQ 群 / QQ 私聊</p>
      </div>
    `),
    c.NapCatConfig.boolean("enabled", "启用插件", true, "关闭后不再转发任何消息"),
    c.NapCatConfig.text("groupIds", "QQ 群号", "", "多个群用英文逗号分隔，例如 123456,789012"),
    c.NapCatConfig.text("privateIds", "QQ 号", "", "多个 QQ 用英文逗号分隔，例如 10001,10002"),
    c.NapCatConfig.boolean("forwardComments", "转发评论艾特", true, "dsh-bili-scroll 发出评论后转发"),
    c.NapCatConfig.boolean("forwardDms", "转发私信", true, "dsh-bili-scroll 发出私信后转发"),
    c.NapCatConfig.boolean("forwardBriefs", "转发 AIGC 日报", true, "dsh-bili-scroll 生成 B站 + GitHub 日报后转发"),
    c.NapCatConfig.boolean("includeLink", "附带 B 站链接", true, "在消息里带上视频或私信链接"),
    c.NapCatConfig.text("prefix", "消息前缀", "【B站】", "显示在每条消息前面"),
    c.NapCatConfig.text("template", "消息模板", DEFAULT_CONFIG.template, "可用占位符: {prefix} {kind} {text} {url} {bvid} {uid}；换行写 \\n"),
    c.NapCatConfig.text("token", "校验口令", "", "和 dsh-bili-scroll 里填的 qqForwardToken 一致；留空不校验"),
    c.NapCatConfig.text("atSign", "群聊 @ 某人", "", "填 QQ 号则每条群消息前 @ 他；留空不 @")
  );
}

export const plugin_init = async (pluginCtx) => {
  ctx = pluginCtx;
  ctx.logger.info("[dsh-bili-forward] 插件初始化中...");
  if (ctx.configPath) loadConfig(ctx.configPath);
  plugin_config_ui = buildConfigSchema(ctx);

  const router = ctx.router;

  router.getNoAuth("/health", (_req, res) => {
    res.json({ code: 0, data: {
      enabled: config.enabled,
      groups: parseIds(config.groupIds).length,
      privates: parseIds(config.privateIds).length,
      forwardComments: config.forwardComments,
      forwardDms: config.forwardDms,
      forwardBriefs: config.forwardBriefs,
    }});
  });

  router.postNoAuth("/forward", async (req, res) => {
    try {
      if (config.token) {
        const got = (req.headers && (req.headers["x-dsh-bili-token"] || req.headers["X-Dsh-Bili-Token"])) || "";
        if (String(got) !== config.token) return res.status(401).json({ code: -1, message: "口令不对" });
      }
      const body = req.body || {};
      const result = await forwardToQQ(body);
      return res.status(result.ok ? 200 : 400).json({ code: result.ok ? 0 : -1, ...result });
    } catch (e) {
      ctx && ctx.logger.error("[dsh-bili-forward] 转发失败: " + String(e && e.message || e));
      return res.status(500).json({ code: -1, message: String(e && e.message || e) });
    }
  });

  router.postNoAuth("/test", async (_req, res) => {
    try {
      const result = await forwardToQQ({
        event: "comment_sent",
        bvid: "BV1TEST",
        text: "这是一条测试消息 " + Date.now(),
        url: "https://www.bilibili.com/video/BV1TEST",
      });
      return res.status(result.ok ? 200 : 400).json({ code: result.ok ? 0 : -1, ...result });
    } catch (e) {
      return res.status(500).json({ code: -1, message: String(e && e.message || e) });
    }
  });

  ctx.logger.info("[dsh-bili-forward] 插件初始化完成");
};

export const plugin_cleanup = async () => { ctx = null; };

export const plugin_get_config = async () => config;

export const plugin_set_config = async (pluginCtx, newConfig) => {
  config = sanitizeConfig({ ...config, ...(newConfig || {}) });
  if (pluginCtx && pluginCtx.configPath) saveConfig(pluginCtx.configPath);
  return config;
};

export const plugin_on_config_change = async (pluginCtx, ui, key, value) => {
  config = sanitizeConfig({ ...config, [key]: value });
  if (pluginCtx && pluginCtx.configPath) saveConfig(pluginCtx.configPath);
};

export const plugin_onmessage = async () => {
  // 只做转发，不处理 QQ 消息命令
};

