const STYLES = `
  #project-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100%;
    background: rgba(5, 5, 16, 0.94);
    border-left: 1px solid rgba(100, 120, 255, 0.18);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transform: translateX(100%);
    transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 50;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', Courier, monospace;
    color: #dde2ff;
  }

  #project-sidebar.open {
    transform: translateX(0);
  }

  .sb-accent {
    height: 3px;
    width: 100%;
    flex-shrink: 0;
    transition: background 0.3s;
  }

  .sb-body {
    flex: 1;
    padding: 28px 24px 32px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .sb-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .sb-title {
    font-size: 15px;
    letter-spacing: 3px;
    font-weight: normal;
    text-transform: uppercase;
    color: #eef0ff;
    line-height: 1.5;
  }

  .sb-close {
    background: none;
    border: none;
    color: rgba(200, 205, 255, 0.35);
    font-size: 22px;
    line-height: 1;
    padding: 0 0 0 10px;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .sb-close:hover { color: rgba(200, 205, 255, 0.9); }

  .sb-desc {
    font-size: 11px;
    letter-spacing: 0.5px;
    color: rgba(180, 188, 230, 0.6);
    line-height: 1.8;
    font-style: italic;
  }

  .sb-divider {
    height: 1px;
    background: rgba(100, 120, 255, 0.12);
  }

  .sb-notes-label {
    font-size: 9px;
    letter-spacing: 3px;
    color: rgba(160, 170, 220, 0.4);
    text-transform: uppercase;
    margin-bottom: -8px;
  }

  .sb-notes {
    font-size: 12px;
    letter-spacing: 0.3px;
    color: rgba(210, 216, 245, 0.82);
    line-height: 1.85;
    white-space: pre-wrap;
  }

  .sb-links {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
    padding-top: 6px;
  }

  .sb-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 14px;
    border: 1px solid rgba(100, 120, 255, 0.22);
    border-radius: 4px;
    color: rgba(180, 190, 255, 0.75);
    text-decoration: none;
    font-size: 10px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    font-family: 'Courier New', Courier, monospace;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .sb-link:hover {
    background: rgba(100, 120, 255, 0.1);
    border-color: rgba(100, 120, 255, 0.45);
    color: #eef0ff;
  }

  .sb-link.hidden { display: none; }
`

export function createSidebar() {
  const styleEl = document.createElement('style')
  styleEl.textContent = STYLES
  document.head.appendChild(styleEl)

  const el = document.createElement('div')
  el.id = 'project-sidebar'
  el.innerHTML = `
    <div class="sb-accent"></div>
    <div class="sb-body">
      <div class="sb-header">
        <h2 class="sb-title"></h2>
        <button class="sb-close" aria-label="Close">×</button>
      </div>
      <p class="sb-desc"></p>
      <div class="sb-divider"></div>
      <div class="sb-notes-label">Notes</div>
      <div class="sb-notes"></div>
      <div class="sb-links">
        <a class="sb-link" id="sb-site"   href="#" target="_blank" rel="noopener">↗ &nbsp;Visit Site</a>
        <a class="sb-link" id="sb-github" href="#" target="_blank" rel="noopener">↗ &nbsp;GitHub</a>
      </div>
    </div>
  `
  document.body.appendChild(el)

  el.querySelector('.sb-close').addEventListener('click', close)

  // Close on backdrop click (clicking outside the panel)
  document.addEventListener('click', (e) => {
    if (el.classList.contains('open') && !el.contains(e.target)) {
      close()
    }
  })

  function open(project) {
    el.querySelector('.sb-accent').style.background = `rgb(${project.accentRGB})`
    el.querySelector('.sb-title').textContent        = project.title
    el.querySelector('.sb-desc').textContent         = project.desc
    el.querySelector('.sb-notes').textContent        = project.notes || ''

    const siteLink = el.querySelector('#sb-site')
    const ghLink   = el.querySelector('#sb-github')

    if (project.siteUrl) {
      siteLink.href = project.siteUrl
      siteLink.classList.remove('hidden')
    } else {
      siteLink.classList.add('hidden')
    }

    if (project.githubUrl) {
      ghLink.href = project.githubUrl
      ghLink.classList.remove('hidden')
    } else {
      ghLink.classList.add('hidden')
    }

    el.classList.add('open')
  }

  function close() {
    el.classList.remove('open')
  }

  return { open, close }
}
