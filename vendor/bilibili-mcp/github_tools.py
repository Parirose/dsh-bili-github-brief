#!/usr/bin/env python3
"""Read-only GitHub tools for the Bilibili + GitHub AIGC brief."""

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

GITHUB_API = "https://api.github.com"
GITHUB_TOKEN = (os.environ.get("BILI_DUTY_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()


def _github_get(path, params=None, accept="application/vnd.github+json"):
    """Small read-only GitHub REST helper. Returns parsed JSON or raw text."""
    url = path if path.startswith("http") else GITHUB_API + path
    if params:
        sep = "&" if "?" in url else "?"
        url = url + sep + urllib.parse.urlencode(params)
    headers = {
        "User-Agent": "dsh-bili-github-brief",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = "Bearer " + GITHUB_TOKEN
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read()
        text = raw.decode("utf-8", "replace")
        if accept == "application/vnd.github.raw":
            return text
        return json.loads(text)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", "replace")[:600]
        except Exception:
            body = ""
        return {"__error__": f"HTTP {e.code}: {body}", "__status__": e.code}
    except Exception as e:
        return {"__error__": f"{type(e).__name__}: {e}"}


def _gh_ok(v):
    return isinstance(v, dict) and "__error__" not in v


def _gh_err(v):
    if isinstance(v, dict) and "__error__" in v:
        return str(v["__error__"])
    return ""


def _gh_repo_item(r):
    return {
        "fullName": r.get("full_name", ""),
        "url": r.get("html_url", ""),
        "description": r.get("description") or "",
        "stars": r.get("stargazers_count", 0),
        "forks": r.get("forks_count", 0),
        "language": r.get("language") or "",
        "createdAt": r.get("created_at"),
        "pushedAt": r.get("pushed_at"),
        "updatedAt": r.get("updated_at"),
        "topics": r.get("topics") or [],
        "license": (r.get("license") or {}).get("spdx_id") if isinstance(r.get("license"), dict) else "",
        "archived": bool(r.get("archived")),
        "openIssues": r.get("open_issues_count", 0),
        "defaultBranch": r.get("default_branch", ""),
    }


def _parse_workflow(text):
    """Static ComfyUI workflow parser. Never executes anything."""
    out = {
        "format": "unknown",
        "nodeCount": 0,
        "nodeTypes": [],
        "modelFiles": [],
        "loraFiles": [],
        "customNodeCandidates": [],
        "error": "",
    }
    try:
        data = json.loads(text)
    except Exception as e:
        out["error"] = f"JSON parse failed: {e}"
        return out

    node_types = []
    if isinstance(data, dict) and isinstance(data.get("nodes"), list):
        out["format"] = "ui"
        for n in data.get("nodes") or []:
            if isinstance(n, dict):
                t = n.get("type") or n.get("class_type") or n.get("classType")
                if isinstance(t, str) and t.strip():
                    node_types.append(t.strip())
        out["nodeCount"] = len(data.get("nodes") or [])
    elif isinstance(data, dict):
        api_nodes = [v for v in data.values() if isinstance(v, dict) and ("class_type" in v or "classType" in v)]
        if api_nodes:
            out["format"] = "api"
            for n in api_nodes:
                t = n.get("class_type") or n.get("classType")
                if isinstance(t, str) and t.strip():
                    node_types.append(t.strip())
            out["nodeCount"] = len(api_nodes)

    node_types = list(dict.fromkeys(node_types))
    out["nodeTypes"] = node_types[:80]

    files = re.findall(r'[A-Za-z0-9_\-\./\\]+\.(?:safetensors|ckpt|pt|pth|gguf|bin)', text, flags=re.IGNORECASE)
    cleaned = []
    for f in files:
        f = f.replace("\\\\", "/").split("/")[-1].strip()
        if f and f not in cleaned:
            cleaned.append(f)
    out["modelFiles"] = cleaned[:80]
    out["loraFiles"] = [f for f in cleaned if "lora" in f.lower()][:40]

    common = {
        "KSampler", "KSamplerAdvanced", "CLIPTextEncode", "VAEDecode", "VAEEncode",
        "CheckpointLoaderSimple", "LoadImage", "SaveImage", "EmptyLatentImage",
        "LoraLoader", "ControlNetLoader", "UpscaleModelLoader", "PreviewImage",
        "ConditioningCombine", "LatentUpscale", "ImageScale", "Note", "Reroute",
        "PrimitiveNode", "CLIPSetLastLayer", "VAELoader", "UNETLoader",
    }
    out["customNodeCandidates"] = [t for t in node_types if t not in common][:40]
    return out



_SKIP_JSON = re.compile(r"(tokenizer|vocab|special_tokens|clip_vision|text_encoder|sd1_|sd2_|sd3_|config|schema|package|tsconfig|manifest|lock)", re.I)


def _workflow_candidates(paths):
    preferred = []
    fallback = []
    for p in paths:
        low = p.lower()
        if not low.endswith(".json"):
            continue
        if _SKIP_JSON.search(p):
            continue
        fallback.append(p)
        if "workflow" in low or "comfy" in low or "example" in low or "graph" in low or "t2v" in low or "i2v" in low or "video" in low:
            preferred.append(p)
    return preferred + [p for p in fallback if p not in preferred]


def install(mcp, tool):
    """Register GitHub tools with the host MCP server."""

    @tool()
    async def github_search(query: str, sort: str = "stars", order: str = "desc", per_page: int = 10) -> str:
        """Search GitHub repositories with GitHub search syntax."""
        per_page = max(1, min(int(per_page or 10), 30))
        sort = sort if sort in {"stars", "forks", "updated", "help-wanted-issues"} else "stars"
        order = order if order in {"desc", "asc"} else "desc"
        data = _github_get("/search/repositories", {"q": query, "sort": sort, "order": order, "per_page": per_page})
        if not _gh_ok(data):
            return json.dumps({"ok": False, "error": _gh_err(data)}, ensure_ascii=False)
        items = [_gh_repo_item(r) for r in (data.get("items") or [])]
        return json.dumps({
            "ok": True,
            "query": query,
            "totalCount": data.get("total_count", 0),
            "incompleteResults": bool(data.get("incomplete_results")),
            "count": len(items),
            "items": items,
        }, ensure_ascii=False)

    @tool()
    async def github_repo(full_name: str) -> str:
        """Get repository metadata and a bounded README excerpt."""
        full_name = str(full_name or "").strip()
        if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", full_name):
            return json.dumps({"ok": False, "error": "full_name must be owner/repo"}, ensure_ascii=False)
        meta = _github_get(f"/repos/{full_name}")
        if not _gh_ok(meta):
            return json.dumps({"ok": False, "error": _gh_err(meta)}, ensure_ascii=False)
        readme = _github_get(f"/repos/{full_name}/readme", accept="application/vnd.github.raw")
        readme_text = readme if isinstance(readme, str) else ""
        item = _gh_repo_item(meta)
        item["readme"] = readme_text[:12000]
        item["readmeTruncated"] = len(readme_text) > 12000
        return json.dumps({"ok": True, "repo": item}, ensure_ascii=False)

    @tool()
    async def github_tree(full_name: str, branch: str = "") -> str:
        """List repository files (bounded), plus workflow JSON candidates."""
        full_name = str(full_name or "").strip()
        if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", full_name):
            return json.dumps({"ok": False, "error": "full_name must be owner/repo"}, ensure_ascii=False)
        if not branch:
            meta = _github_get(f"/repos/{full_name}")
            if not _gh_ok(meta):
                return json.dumps({"ok": False, "error": _gh_err(meta)}, ensure_ascii=False)
            branch = meta.get("default_branch") or "main"
        tree = _github_get(f"/repos/{full_name}/git/trees/{urllib.parse.quote(branch, safe='')}", {"recursive": "1"})
        if not _gh_ok(tree):
            return json.dumps({"ok": False, "error": _gh_err(tree)}, ensure_ascii=False)
        paths = [x.get("path", "") for x in (tree.get("tree") or []) if x.get("type") == "blob"]
        wf = _workflow_candidates(paths)
        return json.dumps({
            "ok": True,
            "fullName": full_name,
            "branch": branch,
            "truncated": bool(tree.get("truncated")),
            "count": len(paths),
            "paths": paths[:3000],
            "workflowCandidates": wf[:80],
        }, ensure_ascii=False)

    @tool()
    async def github_file(full_name: str, path: str, ref: str = "") -> str:
        """Read one repository file as text (bounded)."""
        full_name = str(full_name or "").strip()
        path = str(path or "").strip().lstrip("/")
        if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", full_name) or not path:
            return json.dumps({"ok": False, "error": "full_name/path required"}, ensure_ascii=False)
        enc = urllib.parse.quote(path, safe="/")
        params = {"ref": ref} if ref else None
        text = _github_get(f"/repos/{full_name}/contents/{enc}", params, accept="application/vnd.github.raw")
        if not isinstance(text, str):
            return json.dumps({"ok": False, "error": _gh_err(text)}, ensure_ascii=False)
        return json.dumps({
            "ok": True,
            "fullName": full_name,
            "path": path,
            "ref": ref,
            "text": text[:200000],
            "truncated": len(text) > 200000,
        }, ensure_ascii=False)

    @tool()
    async def github_releases(full_name: str, limit: int = 5) -> str:
        """List recent GitHub releases (tag, name, date, url, asset names)."""
        full_name = str(full_name or "").strip()
        if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", full_name):
            return json.dumps({"ok": False, "error": "full_name must be owner/repo"}, ensure_ascii=False)
        limit = max(1, min(int(limit or 5), 20))
        data = _github_get(f"/repos/{full_name}/releases", {"per_page": limit})
        if isinstance(data, dict) and "__error__" in data:
            return json.dumps({"ok": False, "error": _gh_err(data)}, ensure_ascii=False)
        if not isinstance(data, list):
            return json.dumps({"ok": False, "error": "unexpected GitHub releases response"}, ensure_ascii=False)
        out = []
        for r in data[:limit]:
            out.append({
                "tag": r.get("tag_name", ""),
                "name": r.get("name") or r.get("tag_name", ""),
                "publishedAt": r.get("published_at"),
                "url": r.get("html_url", ""),
                "body": (r.get("body") or "")[:3000],
                "assets": [a.get("name", "") for a in (r.get("assets") or [])][:30],
            })
        return json.dumps({"ok": True, "fullName": full_name, "count": len(out), "releases": out}, ensure_ascii=False)

    @tool()
    async def github_workflows(full_name: str, max_files: int = 3) -> str:
        """Scan a repo for ComfyUI workflow JSON and statically extract node/model/LoRA names."""
        full_name = str(full_name or "").strip()
        if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", full_name):
            return json.dumps({"ok": False, "error": "full_name must be owner/repo"}, ensure_ascii=False)
        max_files = max(1, min(int(max_files or 3), 5))
        meta = _github_get(f"/repos/{full_name}")
        if not _gh_ok(meta):
            return json.dumps({"ok": False, "error": _gh_err(meta)}, ensure_ascii=False)
        branch = meta.get("default_branch") or "main"
        tree = _github_get(f"/repos/{full_name}/git/trees/{urllib.parse.quote(branch, safe='')}", {"recursive": "1"})
        if not _gh_ok(tree):
            return json.dumps({"ok": False, "error": _gh_err(tree)}, ensure_ascii=False)
        paths = [x.get("path", "") for x in (tree.get("tree") or []) if x.get("type") == "blob"]
        candidates = _workflow_candidates(paths)
        workflows = []
        skipped = 0
        for path in candidates[:max_files]:
            text = _github_get(f"/repos/{full_name}/contents/{urllib.parse.quote(path, safe='/')}", {"ref": branch}, accept="application/vnd.github.raw")
            if not isinstance(text, str):
                skipped += 1
                continue
            info = _parse_workflow(text)
            if info.get("format") == "unknown" or int(info.get("nodeCount") or 0) <= 0:
                skipped += 1
                continue
            info["path"] = path
            info["url"] = f"https://github.com/{full_name}/blob/{branch}/{path}"
            info["size"] = len(text)
            workflows.append(info)
        return json.dumps({
            "ok": True,
            "fullName": full_name,
            "branch": branch,
            "workflowCandidates": candidates[:80],
            "scanned": len(workflows) + skipped,
            "parsed": len(workflows),
            "skipped": skipped,
            "workflows": workflows,
        }, ensure_ascii=False)

    return {
        "github_search": github_search,
        "github_repo": github_repo,
        "github_tree": github_tree,
        "github_file": github_file,
        "github_releases": github_releases,
        "github_workflows": github_workflows,
    }
