const DATA_URL = "./韩国文化爆款素材库/materials.jsonl";

const state = {
  materials: [],
  category: "全部",
  query: "",
  sort: "priority",
  selectedId: null,
};

const elements = {
  materialCount: document.querySelector("#material-count"),
  updatedDate: document.querySelector("#updated-date"),
  searchInput: document.querySelector("#search-input"),
  sortSelect: document.querySelector("#sort-select"),
  categoryTabs: document.querySelector("#category-tabs"),
  materialList: document.querySelector("#material-list"),
  resultCount: document.querySelector("#result-count"),
  emptyState: document.querySelector("#empty-state"),
  detailPane: document.querySelector("#detail-pane"),
  detailContent: document.querySelector("#detail-content"),
  mobileBack: document.querySelector("#mobile-back"),
};

const priorityOrder = { S: 0, A: 1, B: 2 };
const categoryColors = {
  "语言/双关": "#d83b43",
  "语言/谐音": "#007f75",
  "语言/外语耳误听": "#245fbd",
  "语言/语境": "#9a5b00",
  "语言/缩写": "#7551a6",
  "生活/习惯": "#138044",
  "社交/关系": "#b14983",
  "网络/刻板印象": "#c05222",
};

function totalScore(material) {
  return Object.values(material.scores || {}).reduce(
    (total, score) => total + Number(score || 0),
    0,
  );
}

function displayDate(dateString) {
  if (!dateString) return "--";
  const [year, month, day] = dateString.split("-");
  return `${year}.${month}.${day}`;
}

function sourceLabel(url, index) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `${index + 1}. ${host}`;
  } catch {
    return `${index + 1}. 查看来源`;
  }
}

async function loadMaterials() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    state.materials = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    const newestDate = [...state.materials]
      .map((material) => material.added_on)
      .filter(Boolean)
      .sort()
      .at(-1);

    elements.materialCount.textContent = String(state.materials.length);
    elements.updatedDate.textContent = displayDate(newestDate);

    renderCategories();
    renderList();
  } catch (error) {
    elements.resultCount.textContent = "素材加载失败";
    elements.materialList.innerHTML = "";
    elements.emptyState.hidden = false;
    elements.emptyState.querySelector("strong").textContent = "暂时无法读取素材库";
    elements.emptyState.querySelector("span").textContent =
      "请刷新页面后重试。";
    console.error("Failed to load materials:", error);
  }
}

function renderCategories() {
  const categories = [
    "全部",
    ...new Set(state.materials.map((material) => material.category)),
  ];

  elements.categoryTabs.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    const count =
      category === "全部"
        ? state.materials.length
        : state.materials.filter((item) => item.category === category).length;

    button.type = "button";
    button.className = `category-tab${state.category === category ? " is-active" : ""}`;
    button.textContent = `${category} ${count}`;
    button.addEventListener("click", () => {
      state.category = category;
      renderCategories();
      renderList();
    });

    elements.categoryTabs.appendChild(button);
  });
}

function getVisibleMaterials() {
  const query = state.query.trim().toLocaleLowerCase();
  const visible = state.materials.filter((material) => {
    const inCategory =
      state.category === "全部" || material.category === state.category;
    const searchable = [
      material.keyword,
      material.title_zh,
      material.core_zh,
      material.core_en,
      material.category,
      ...(material.criteria || []),
    ]
      .join(" ")
      .toLocaleLowerCase();

    return inCategory && (!query || searchable.includes(query));
  });

  return visible.sort((a, b) => {
    if (state.sort === "score") {
      return totalScore(b) - totalScore(a);
    }
    if (state.sort === "newest") {
      return String(b.added_on).localeCompare(String(a.added_on));
    }
    if (state.sort === "unused") {
      if (a.used !== b.used) return a.used ? 1 : -1;
      return totalScore(b) - totalScore(a);
    }

    const priorityDifference =
      (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    return priorityDifference || totalScore(b) - totalScore(a);
  });
}

function renderList() {
  const materials = getVisibleMaterials();
  elements.resultCount.textContent = `找到 ${materials.length} 条素材`;
  elements.emptyState.hidden = materials.length > 0;
  elements.materialList.innerHTML = "";

  materials.forEach((material) => {
    const row = document.createElement("button");
    const accent = categoryColors[material.category] || "#007f75";
    const score = totalScore(material);

    row.type = "button";
    row.className = `material-row${state.selectedId === material.id ? " is-selected" : ""}`;
    row.style.setProperty("--row-accent", accent);
    row.setAttribute("aria-label", `查看 ${material.keyword} 的完整信息`);

    row.innerHTML = `
      <span class="row-keyword-wrap">
        <span class="row-keyword"></span>
        <span class="row-id"></span>
      </span>
      <span class="row-copy">
        <span class="row-title"></span>
        <span class="row-summary"></span>
      </span>
      <span class="row-signals">
        <span class="priority-badge"></span>
        <span class="row-score"><strong></strong> / 25</span>
        <span class="used-label"></span>
      </span>
    `;

    row.querySelector(".row-keyword").textContent = material.keyword;
    row.querySelector(".row-id").textContent = material.id;
    row.querySelector(".row-title").textContent = material.title_zh;
    row.querySelector(".row-summary").textContent = material.core_zh;

    const priorityBadge = row.querySelector(".priority-badge");
    priorityBadge.textContent = `${material.priority}级`;
    if (material.priority === "S") {
      priorityBadge.classList.add("priority-s");
    }

    row.querySelector(".row-score strong").textContent = String(score);
    row.querySelector(".used-label").textContent = material.used
      ? "已使用"
      : "待开发";

    row.addEventListener("click", () => selectMaterial(material.id));
    elements.materialList.appendChild(row);
  });

  if (
    state.selectedId &&
    !materials.some((material) => material.id === state.selectedId)
  ) {
    state.selectedId = null;
    renderPlaceholder();
  }
}

function selectMaterial(id) {
  state.selectedId = id;
  const material = state.materials.find((item) => item.id === id);
  if (!material) return;

  renderList();
  renderDetail(material);

  if (window.matchMedia("(max-width: 760px)").matches) {
    elements.detailPane.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
}

function renderPlaceholder() {
  elements.detailContent.innerHTML = `
    <div class="detail-placeholder">
      <span class="placeholder-index">01</span>
      <strong>选择一条素材</strong>
      <p>这里会显示完整解释、传播评分、事实边界和来源。</p>
    </div>
  `;
}

function renderDetail(material) {
  const scoreLabels = {
    discussion: "讨论度",
    shock: "冲击感",
    recognition: "认知度",
    spread: "传播性",
    viral_proof: "爆款证据",
  };
  const scoreColors = {
    discussion: "#245fbd",
    shock: "#d83b43",
    recognition: "#007f75",
    spread: "#9a5b00",
    viral_proof: "#7551a6",
  };

  elements.detailContent.innerHTML = "";

  const header = document.createElement("header");
  header.className = "detail-header";
  header.innerHTML = `
    <div class="detail-kicker">
      <span class="category-badge"></span>
      <span class="priority-badge"></span>
    </div>
    <h2 class="detail-keyword"></h2>
    <p class="detail-title"></p>
  `;
  header.querySelector(".category-badge").textContent = material.category;
  const priority = header.querySelector(".priority-badge");
  priority.textContent = `${material.priority}级 · ${totalScore(material)}/25`;
  if (material.priority === "S") priority.classList.add("priority-s");
  header.querySelector(".detail-keyword").textContent = material.keyword;
  header.querySelector(".detail-title").textContent = material.title_zh;
  elements.detailContent.appendChild(header);

  elements.detailContent.appendChild(
    createSection("核心解释", (section) => {
      const chinese = document.createElement("p");
      chinese.textContent = material.core_zh;
      const english = document.createElement("p");
      english.className = "english-copy";
      english.textContent = material.core_en;
      section.append(chinese, english);
    }),
  );

  elements.detailContent.appendChild(
    createSection("封面钩子", (section) => {
      const hook = document.createElement("p");
      hook.className = "cover-hook";
      hook.textContent = material.cover_hook;
      section.appendChild(hook);
    }),
  );

  elements.detailContent.appendChild(
    createSection("传播评分", (section) => {
      const grid = document.createElement("div");
      grid.className = "score-grid";

      Object.entries(scoreLabels).forEach(([key, label]) => {
        const score = Number(material.scores?.[key] || 0);
        const row = document.createElement("div");
        row.className = "score-row";
        row.innerHTML = `
          <span></span>
          <span class="score-track"><span class="score-fill"></span></span>
          <strong></strong>
        `;
        row.children[0].textContent = label;
        row.querySelector(".score-fill").style.width = `${score * 20}%`;
        row.querySelector(".score-fill").style.setProperty(
          "--score-color",
          scoreColors[key],
        );
        row.querySelector("strong").textContent = String(score);
        grid.appendChild(row);
      });

      const criteria = document.createElement("div");
      criteria.className = "criteria-list";
      (material.criteria || []).forEach((item) => {
        const badge = document.createElement("span");
        badge.className = "criterion-badge";
        badge.textContent = item;
        criteria.appendChild(badge);
      });

      section.append(grid, criteria);
    }),
  );

  elements.detailContent.appendChild(
    createSection("证据与核验", (section) => {
      const evidenceLine = document.createElement("div");
      evidenceLine.className = "evidence-line";
      const badge = document.createElement("span");
      badge.className = "status-badge";
      badge.textContent = material.evidence_level;
      const note = document.createElement("span");
      note.className = "evidence-note";
      note.textContent = material.evidence_note;
      evidenceLine.append(badge, note);

      const verification = document.createElement("p");
      verification.className = "verification-copy";
      verification.textContent = material.verification;
      section.append(evidenceLine, verification);
    }),
  );

  elements.detailContent.appendChild(
    createSection("事实边界与风险", (section) => {
      const risk = document.createElement("p");
      risk.className = "risk-copy";
      risk.textContent = material.risk;
      section.appendChild(risk);
    }),
  );

  elements.detailContent.appendChild(
    createSection("来源", (section) => {
      const urls = material.source_urls || [];
      if (!urls.length) {
        const empty = document.createElement("span");
        empty.className = "no-source";
        empty.textContent = "来源链接待补充";
        section.appendChild(empty);
        return;
      }

      const list = document.createElement("ul");
      list.className = "source-list";
      urls.forEach((url, index) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = sourceLabel(url, index);
        link.title = url;
        item.appendChild(link);
        list.appendChild(item);
      });
      section.appendChild(list);
    }),
  );
}

function createSection(label, populate) {
  const section = document.createElement("section");
  section.className = "detail-section";
  const heading = document.createElement("span");
  heading.className = "section-label";
  heading.textContent = label;
  section.appendChild(heading);
  populate(section);
  return section;
}

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderList();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderList();
});

elements.mobileBack.addEventListener("click", () => {
  elements.detailPane.classList.remove("is-open");
  document.body.style.overflow = "";
});

window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 760px)").matches) {
    elements.detailPane.classList.remove("is-open");
    document.body.style.overflow = "";
  }
});

loadMaterials();
