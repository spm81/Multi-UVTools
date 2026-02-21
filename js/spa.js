const pages = Array.from(document.querySelectorAll("[data-page]"));
const navItems = document.querySelectorAll(".nav-item[data-nav]");

const pageTitles = {
  instructions: "Instructions",
  home: "Multi-UVTools",
  channels: "Channel configuration",
  settings: "Basic settings",
  mirror: "Display mirror",
  smr: "SMR",
  k1: "UV-K1 Tools",
  "h3-flash": "TD-H3/H8 Flash",
  "h3-channels": "TD-H3/H8 Channels",
  "h3-bandplan": "TD-H3/H8 Band Plan",
  "h3-codeplug": "TD-H3/H8 Codeplug",
  "rt880-flash": "RT-880 Flash",
  "rt880-monitor": "RT-880 Monitor",
  "rt880-remote": "RT-880 Web Remote",
  "rt880-spi": "RT-880 SPI Backup",
};

const bodyClassForPage = {
  mirror: "mirror-page",
  smr: "smr-page",
};

const updateNavigation = (pageId) => {
  navItems.forEach((item) => {
    const isActive = item.getAttribute("data-nav") === pageId;
    item.classList.toggle("active", isActive);
  });
  
  // Also update sidebar navigation
  const sidebarLinks = document.querySelectorAll(".sidebar .nav a");
  sidebarLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const linkPageId = href ? href.replace("#", "") : "";
    link.classList.toggle("active", linkPageId === pageId);
  });
};

const setActivePage = (pageId) => {
  pages.forEach((page) => {
    const isActive = page.id === pageId;
    page.classList.toggle("active", isActive);
    page.hidden = !isActive;
  });

  const title = pageTitles[pageId] || pageTitles.instructions;
  document.title = title;

  document.body.classList.remove("mirror-page", "smr-page");
  const bodyClass = bodyClassForPage[pageId];
  if (bodyClass) {
    document.body.classList.add(bodyClass);
  }

  // Update navigation bar active state
  updateNavigation(pageId);

  window.scrollTo({ top: 0, behavior: "auto" });
  window.dispatchEvent(new CustomEvent("spa:page", { detail: { pageId } }));
};

const resolvePageFromHash = () => {
  const hash = window.location.hash.replace("#", "");
  const target = pages.find((page) => page.id === hash);
  return target ? target.id : "instructions";
};

const ensureDefaultHash = () => {
  if (!window.location.hash) {
    window.location.hash = "#instructions";
  }
};

const handleRouteChange = () => {
  ensureDefaultHash();
  setActivePage(resolvePageFromHash());
};

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();
