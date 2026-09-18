import re
from pathlib import Path

# Generates every page of the EON site. The document bodies (changelog / privacy /
# terms) are read back from the current pages themselves — edit those <article>s in
# place (e.g. add a new release to changelog.html), then re-run this to refresh the
# shared header / footer across all pages.
OUT = Path(__file__).resolve().parent.parent
SRC = OUT

APP_EN = "https://apps.apple.com/app/id6771706897"
APP_ZH = "https://apps.apple.com/cn/app/id6771706897"

HEAD = """<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{title_en}</title>
  <meta name="description" content="EON tracks your subscriptions, reminds you before renewals and shows where your money goes. Free, private, on iPhone, iPad and Mac." />
  <script>
    (function () {{
      var l;
      try {{ l = localStorage.getItem("eon-lang"); }} catch (e) {{}}
      if (l !== "zh" && l !== "en") l = (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
      var h = document.documentElement;
      h.setAttribute("data-lang", l);
      h.setAttribute("lang", l === "zh" ? "zh-Hans" : "en");
      h.dataset.titleEn = {title_en_js};
      h.dataset.titleZh = {title_zh_js};
      document.title = l === "zh" ? h.dataset.titleZh : h.dataset.titleEn;
    }})();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="icon" href="assets/logo.webp" type="image/webp" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="{body_class}">
  <!-- Night sky + a moon that slowly walks through its phases (drawn in main.js). -->
  <div class="bg" aria-hidden="true">
    <canvas class="sky" data-moon="{moon}"></canvas>
    <div class="bg-grain"></div>
  </div>
"""

NAV = [
    ("home", "index.html", "Home", "首页"),
    ("changelog", "changelog.html", "Changelog", "更新日志"),
    ("privacy", "privacy.html", "Privacy", "隐私"),
    ("contact", "contact.html", "Contact", "联系"),
]


def bi(en, zh):
    return f'<span class="en">{en}</span><span class="zh">{zh}</span>'


def app_link(cls, inner, extra=""):
    return (f'<a class="{cls}" href="{APP_EN}" data-href-en="{APP_EN}" data-href-zh="{APP_ZH}"'
            f' target="_blank" rel="noopener"{extra}>{inner}</a>')


def header(active):
    links = []
    for key, href, en, zh in NAV:
        a = ' is-active" aria-current="page' if key == active else ""
        links.append(f'        <a class="nav-link{a}" href="{href}">{bi(en, zh)}</a>')
    mlinks = []
    for i, (key, href, en, zh) in enumerate(NAV):
        a = ' is-active" aria-current="page' if key == active else ""
        mlinks.append(f'      <a class="mobile-link{a}" href="{href}" style="--i: {i}">{bi(en, zh)}</a>')
    apple = '<i class="fa-brands fa-apple" aria-hidden="true"></i>'
    return f"""
  <div class="page">
    <header class="header">
      <a class="logo" href="index.html" aria-label="EON">
        <img src="assets/logo.webp" alt="" width="52" height="52" />
      </a>

      <nav class="nav" aria-label="Primary">
{chr(10).join(links)}
      </nav>

      <div class="lang" role="group" aria-label="Language / 语言">
        <button type="button" data-l="zh" lang="zh-Hans">中</button>
        <button type="button" data-l="en" lang="en">EN</button>
      </div>

      {app_link("sign-in", apple + " " + bi("Download", "下载"))}

      <button class="burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span><span></span>
      </button>
    </header>

    <div class="menu-overlay" hidden></div>
    <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile" hidden>
{chr(10).join(mlinks)}
      {app_link("mobile-sign-in", apple + " " + bi("Download on the App Store", "在 App Store 下载"), ' style="--i: 4"')}
    </nav>
"""


FOOT_SCRIPT = """
  <script src="main.js"></script>
</body>
</html>
"""


def doc_footer():
    return f"""
    <footer class="doc-footer">
      <div class="doc-footer-links">
        <a href="index.html">{bi("Home", "首页")}</a>
        <a href="changelog.html">{bi("Changelog", "更新日志")}</a>
        <a href="privacy.html">{bi("Privacy", "隐私政策")}</a>
        <a href="terms.html">{bi("Terms", "使用条款")}</a>
        <a href="contact.html">{bi("Contact", "联系")}</a>
      </div>
      <p>© 2026 EON · <a href="mailto:hi@thisleon.com">hi@thisleon.com</a></p>
    </footer>
  </div>
"""


def js(s):
    return '"' + s.replace('"', '\\"') + '"'


def head(title_en, title_zh, body_class, moon):
    return HEAD.format(title_en=title_en, title_en_js=js(title_en), title_zh_js=js(title_zh),
                       body_class=body_class, moon=moon)


# ---------- Home ----------

def home():
    apple = '<i class="fa-brands fa-apple" aria-hidden="true"></i>'
    stats = [
        ("$", 48, "", "Currencies, rates updated daily", "种货币，汇率每日更新"),
        ("#", 210, "", "Built-in service icons", "个内置服务图标"),
        ("*", 8, "", "Languages", "种语言"),
        ("%", 100, "%", "Free — no ads, no account", "免费 · 无广告 · 无需注册"),
    ]
    stat_html = []
    for i, (icon, target, suffix, en, zh) in enumerate(stats):
        d = 0.5 + i * 0.08
        stat_html.append(f"""      <div class="stat anim" style="--d: {d:.2f}s">
        <span class="stat-icon" aria-hidden="true">{icon}</span>
        <span class="stat-value" data-target="{target}" data-suffix="{suffix}" data-decimals="0">0{suffix}</span>
        <span class="stat-label">{bi(en, zh)}</span>
      </div>""")

    body = f"""
    <main class="hero">
      <div class="trust anim" style="--d: 0.05s">
        <span class="trust-avatar a1" title="iPhone"><span class="trust-inner"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i></span></span>
        <span class="trust-avatar a2" title="iPad"><span class="trust-inner"><i class="fa-solid fa-tablet-screen-button" aria-hidden="true"></i></span></span>
        <span class="trust-avatar a3" title="Mac"><span class="trust-inner"><i class="fa-solid fa-laptop" aria-hidden="true"></i></span></span>
        <span class="trust-pill">{bi("Free on iPhone, iPad &amp; Mac", "iPhone · iPad · Mac 免费使用")}</span>
      </div>

      <h1 class="headline anim">
        <span class="en">
          <span class="line" style="--ld: 0.12s">Every Subscription</span>
          <span class="line" style="--ld: 0.3s">In Its Phase</span>
        </span>
        <span class="zh">
          <span class="line dot-cjk" style="--ld: 0.12s">每一笔订阅</span>
          <span class="line dot-cjk" style="--ld: 0.3s">都有它的月相</span>
        </span>
      </h1>

      <p class="subhead anim" style="--d: 0.28s">
        {bi("Track every renewal, get reminded before you're charged, and see where your money goes — private by design, synced through your own iCloud.",
            "记下每一次续费，扣费前提醒你，看清钱都花在了哪里 —— 隐私优先，只通过你自己的 iCloud 同步。")}
      </p>

      {app_link("cta anim", apple + " " + bi("Get EON", "免费下载"), ' style="--d: 0.4s"')}
    </main>

    <footer class="stats" aria-label="EON">
{chr(10).join(stat_html)}
    </footer>
  </div>
"""
    return (head("EON — Every Subscription, In Its Phase", "EON：订阅管理 —— 每一笔订阅，都有它的月相",
                 "home", "hero")
            + header("home") + body + FOOT_SCRIPT)


# ---------- Doc pages (content copied from eon-site) ----------

def main_inner(name):
    s = (SRC / name).read_text(encoding="utf-8")
    m = re.search(r'<article class="doc[^"]*"[^>]*>(.*?)</article>', s, re.S) \
        or re.search(r'<main class="doc">(.*?)</main>', s, re.S)
    return m.group(1)


def doc_page(name, active, title_en, title_zh, kicker_en, kicker_zh):
    inner = main_inner(name)
    body = f"""
    <main class="doc-main">
      <p class="kicker anim" style="--d: 0.05s">{bi(kicker_en, kicker_zh)}</p>
      <article class="doc anim" style="--d: 0.15s">{inner}</article>
    </main>
{doc_footer()}"""
    return head(title_en, title_zh, "doc-page", "corner") + header(active) + body + FOOT_SCRIPT


def contact_page():
    rows = [
        ("x", '<i class="fa-brands fa-x-twitter" aria-hidden="true"></i>', "X", "@thisleon12",
         f'<a class="contact-action" href="https://x.com/thisleon12" target="_blank" rel="noopener">{bi("Follow", "关注")} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>'),
        ("xhs", '<span class="xhs-mark" aria-hidden="true">小红书</span>', bi("Xiaohongshu (RED)", "小红书"),
         f'@ThisLeon <span class="contact-sub">{bi("RED ID", "小红书号")} 95993219565</span>',
         f'<button class="contact-action" type="button" data-copy="95993219565">{bi("Copy ID", "复制号码")} <i class="fa-regular fa-copy" aria-hidden="true"></i></button>'),
        ("mail", '<i class="fa-regular fa-envelope" aria-hidden="true"></i>', bi("Email", "邮箱"), "hi@thisleon.com",
         f'<a class="contact-action" href="mailto:hi@thisleon.com">{bi("Write", "写信")} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>'),
    ]
    items = "\n".join(f"""        <li class="contact-row">
          <span class="contact-icon contact-{key}">{icon}</span>
          <span class="contact-text">
            <span class="contact-label">{label}</span>
            <span class="contact-handle">{handle}</span>
          </span>
          {action}
        </li>""" for key, icon, label, handle, action in rows)
    body = f"""
    <main class="doc-main">
      <p class="kicker anim" style="--d: 0.05s">{bi("Say hi", "打个招呼")}</p>
      <article class="doc anim" style="--d: 0.15s">
        <h1>{bi("Contact", "联系我")}</h1>
        <p class="muted">{bi("Feedback, bug reports, feature ideas — all welcome. EON is made by one person, and every message gets read.",
                           "反馈、Bug、功能想法都欢迎。EON 由一个人独立开发，每条消息都会看。")}</p>
        <ul class="contact-list">
{items}
        </ul>
      </article>
    </main>
{doc_footer()}"""
    return head("EON — Contact", "EON —— 联系我", "doc-page", "corner") + header("contact") + body + FOOT_SCRIPT


(OUT / "contact.html").write_text(contact_page(), encoding="utf-8")
(OUT / "index.html").write_text(home(), encoding="utf-8")
(OUT / "changelog.html").write_text(
    doc_page("changelog.html", "changelog", "EON — Changelog", "EON —— 更新日志", "Release history", "版本记录"),
    encoding="utf-8")
(OUT / "privacy.html").write_text(
    doc_page("privacy.html", "privacy", "EON — Privacy Policy", "EON —— 隐私政策", "Private by design", "隐私优先"),
    encoding="utf-8")
(OUT / "terms.html").write_text(
    doc_page("terms.html", None, "EON — Terms of Use", "EON —— 使用条款", "The small print", "使用条款"),
    encoding="utf-8")
print("ok")
