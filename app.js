import { BRIDGES, EDGES, FLASHCARDS, MECHANICS, NODES } from "./data.js";

const NODE_W = 154;
const NODE_H = 50;
const PADDING = 120;

const dom = {
  workspace: document.querySelector(".workspace"),
  wrap: document.querySelector("#canvas-wrap"),
  edgeLayer: document.querySelector("#edge-layer"),
  nodeLayer: document.querySelector("#node-layer"),
  minimap: document.querySelector("#minimap"),
  search: document.querySelector("#search"),
  visibleCount: document.querySelector("#visible-count"),
  emptyState: document.querySelector("#empty-state"),
  zoomReadout: document.querySelector("#zoom-readout"),
  panel: document.querySelector("#detail-panel"),
  panelEmpty: document.querySelector(".panel-empty"),
  panelContent: document.querySelector("#panel-content"),
  panelBadge: document.querySelector("#panel-badge"),
  panelId: document.querySelector("#panel-id"),
  panelLabel: document.querySelector("#panel-label"),
  panelDescription: document.querySelector("#panel-description"),
  incoming: document.querySelector("#incoming-list"),
  outgoing: document.querySelector("#outgoing-list"),
  bridgeList: document.querySelector("#bridge-list"),
  mechanics: document.querySelector("#mechanics"),
  mechanicsDefinition: document.querySelector("#mechanics-definition"),
  mechanicsChain: document.querySelector("#mechanics-chain"),
  mechanicsReasoning: document.querySelector("#mechanics-reasoning"),
  mechanicsClinical: document.querySelector("#mechanics-clinical"),
  mechanicsConfusion: document.querySelector("#mechanics-confusion"),
  mechanicsNext: document.querySelector("#mechanics-next"),
  mechanicsEmpty: document.querySelector("#mechanics-empty"),
  quizSection: document.querySelector("#quiz-section"),
  quizCount: document.querySelector("#quiz-count"),
  quizList: document.querySelector("#quiz-list"),
  quizEmpty: document.querySelector("#quiz-empty"),
  quizReset: document.querySelector("#quiz-reset"),
  sidebar: document.querySelector("#sidebar"),
  scrim: document.querySelector("#scrim"),
};

const bounds = {
  minX: Math.min(...NODES.map((node) => node.x)) - PADDING,
  minY: Math.min(...NODES.map((node) => node.y)) - PADDING,
  maxX: Math.max(...NODES.map((node) => node.x)) + NODE_W + PADDING,
  maxY: Math.max(...NODES.map((node) => node.y)) + NODE_H + PADDING,
};
bounds.width = bounds.maxX - bounds.minX;
bounds.height = bounds.maxY - bounds.minY;

const nodes = NODES.map((node) => ({
  ...node,
  type: node.type || "default",
  px: node.x - bounds.minX,
  py: node.y - bounds.minY,
}));
const nodeById = new Map(nodes.map((node) => [node.id, node]));
const nodeElements = new Map();
const edgeRecords = [];

const state = {
  scale: 1,
  x: 0,
  y: 0,
  selectedId: null,
  query: "",
  enabledTrees: new Set(["A", "B"]),
  enabledTypes: new Set(["root", "branch", "test", "intervention", "clinical", "default"]),
  bridgesVisible: true,
  pointer: null,
  dragging: false,
  pinchDistance: null,
};

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function connectorPath(source, target, radius = 10) {
  const sx = source.px + NODE_W / 2;
  const sy = source.py + NODE_H;
  const tx = target.px + NODE_W / 2;
  const ty = target.py;
  const middleY = (sy + ty) / 2;
  const directionX = Math.sign(tx - sx) || 1;
  const directionY = Math.sign(ty - sy) || 1;

  if (Math.abs(tx - sx) < 1 || Math.abs(ty - sy) < radius * 2) {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${middleY - radius * directionY}`,
    `Q ${sx} ${middleY} ${sx + radius * directionX} ${middleY}`,
    `L ${tx - radius * directionX} ${middleY}`,
    `Q ${tx} ${middleY} ${tx} ${middleY + radius * directionY}`,
    `L ${tx} ${ty}`,
  ].join(" ");
}

function renderEdges() {
  dom.edgeLayer.setAttribute("width", bounds.width);
  dom.edgeLayer.setAttribute("height", bounds.height);
  dom.edgeLayer.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);

  for (const edge of EDGES) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    const path = createSvgElement("path", {
      class: `edge tree-${edge.tree}`,
      d: connectorPath(source, target),
    });
    dom.edgeLayer.append(path);
    edgeRecords.push({ ...edge, kind: "edge", element: path });
  }

  for (const bridge of BRIDGES) {
    const source = nodeById.get(bridge.source);
    const target = nodeById.get(bridge.target);
    if (!source || !target) continue;
    const path = createSvgElement("path", {
      class: "edge bridge",
      d: connectorPath(source, target, 14),
    });
    dom.edgeLayer.append(path);
    edgeRecords.push({ ...bridge, kind: "bridge", element: path });
  }
}

function renderNodes() {
  for (const node of nodes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-node tree-${node.tree} type-${node.type}`;
    button.style.left = `${node.px}px`;
    button.style.top = `${node.py}px`;
    button.dataset.nodeId = node.id;
    button.setAttribute("aria-label", `${node.label}：${node.fullName}`);
    button.innerHTML = `<span>${escapeHtml(node.label)}</span>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectNode(node.id);
    });
    dom.nodeLayer.append(button);
    nodeElements.set(node.id, button);
  }
}

function renderMinimap() {
  dom.minimap.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  dom.minimap.setAttribute("preserveAspectRatio", "xMidYMid meet");

  for (const edge of EDGES) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    dom.minimap.append(
      createSvgElement("line", {
        x1: source.px + NODE_W / 2,
        y1: source.py + NODE_H / 2,
        x2: target.px + NODE_W / 2,
        y2: target.py + NODE_H / 2,
        stroke: edge.tree === "A" ? "#f0a86b" : "#6ee7b7",
        "stroke-width": 10,
        opacity: 0.23,
      }),
    );
  }

  for (const node of nodes) {
    dom.minimap.append(
      createSvgElement("rect", {
        x: node.px,
        y: node.py,
        width: NODE_W,
        height: NODE_H,
        rx: 7,
        fill: node.tree === "A" ? "#f0a86b" : "#6ee7b7",
        opacity: 0.48,
      }),
    );
  }

  const viewport = createSvgElement("rect", {
    id: "minimap-viewport",
    fill: "none",
    stroke: "#dce9e3",
    "stroke-width": 17,
    opacity: 0.5,
  });
  dom.minimap.append(viewport);
}

function applyTransform() {
  const transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  dom.nodeLayer.style.transform = transform;
  dom.edgeLayer.style.transform = transform;
  dom.zoomReadout.textContent = `${Math.round(state.scale * 100)}%`;
  updateMinimapViewport();
}

function fitView() {
  const rect = dom.wrap.getBoundingClientRect();
  const scaleX = (rect.width - 70) / bounds.width;
  const scaleY = (rect.height - 70) / bounds.height;
  state.scale = Math.max(0.12, Math.min(scaleX, scaleY, 0.92));
  state.x = (rect.width - bounds.width * state.scale) / 2;
  state.y = (rect.height - bounds.height * state.scale) / 2;
  applyTransform();
}

function setZoom(nextScale, anchorX = dom.wrap.clientWidth / 2, anchorY = dom.wrap.clientHeight / 2) {
  const clamped = Math.max(0.1, Math.min(2.5, nextScale));
  const ratio = clamped / state.scale;
  state.x = anchorX - (anchorX - state.x) * ratio;
  state.y = anchorY - (anchorY - state.y) * ratio;
  state.scale = clamped;
  applyTransform();
}

function centerNode(nodeId, targetScale = Math.max(state.scale, 0.78)) {
  const node = nodeById.get(nodeId);
  if (!node) return;
  const rect = dom.wrap.getBoundingClientRect();
  state.scale = Math.min(targetScale, 1.25);
  state.x = rect.width / 2 - (node.px + NODE_W / 2) * state.scale;
  state.y = rect.height / 2 - (node.py + NODE_H / 2) * state.scale;
  applyTransform();
}

function updateMinimapViewport() {
  const viewport = dom.minimap.querySelector("#minimap-viewport");
  if (!viewport) return;
  viewport.setAttribute("x", -state.x / state.scale);
  viewport.setAttribute("y", -state.y / state.scale);
  viewport.setAttribute("width", dom.wrap.clientWidth / state.scale);
  viewport.setAttribute("height", dom.wrap.clientHeight / state.scale);
}

function nodeMatches(node) {
  if (!state.enabledTrees.has(node.tree) || !state.enabledTypes.has(node.type)) return false;
  if (!state.query) return true;
  const haystack = `${node.label} ${node.fullName} ${node.id}`.toLocaleLowerCase("zh-Hant");
  return haystack.includes(state.query);
}

function updateFilters() {
  const visibleIds = new Set();
  for (const node of nodes) {
    const visible = nodeMatches(node);
    nodeElements.get(node.id)?.classList.toggle("hidden", !visible);
    if (visible) visibleIds.add(node.id);
  }

  for (const edge of edgeRecords) {
    const endpointsVisible = visibleIds.has(edge.source) && visibleIds.has(edge.target);
    const bridgeEnabled = edge.kind !== "bridge" || state.bridgesVisible;
    edge.element.style.display = endpointsVisible && bridgeEnabled ? "" : "none";
  }

  dom.visibleCount.textContent = visibleIds.size;
  dom.emptyState.hidden = visibleIds.size !== 0;

  if (state.selectedId && !visibleIds.has(state.selectedId)) {
    closePanel();
  }
}

function relationButton(node, prefix = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `${prefix}${node.label}`;
  button.addEventListener("click", () => {
    selectNode(node.id);
    centerNode(node.id);
  });
  return button;
}

function renderRelationList(container, relatedNodes, prefix) {
  container.replaceChildren();
  if (!relatedNodes.length) {
    const empty = document.createElement("span");
    empty.className = "none";
    empty.textContent = "無";
    container.append(empty);
    return;
  }
  for (const node of relatedNodes) {
    container.append(relationButton(node, prefix));
  }
}

function setMechanicsSection(sectionId, visible) {
  document.querySelector(sectionId).hidden = !visible;
}

function renderMechanics(nodeId) {
  const mechanics = MECHANICS[nodeId];
  const hasContent =
    mechanics &&
    (mechanics.definition ||
      mechanics.chain?.length ||
      mechanics.reasoning?.length ||
      mechanics.clinical ||
      mechanics.confusion ||
      mechanics.next_nodes?.length);

  dom.mechanicsEmpty.hidden = Boolean(hasContent);
  setMechanicsSection("#definition-section", Boolean(mechanics?.definition));
  setMechanicsSection("#chain-section", Boolean(mechanics?.chain?.length));
  setMechanicsSection("#reasoning-section", Boolean(mechanics?.reasoning?.length));
  setMechanicsSection("#clinical-section", Boolean(mechanics?.clinical));
  setMechanicsSection("#confusion-section", Boolean(mechanics?.confusion));
  setMechanicsSection("#next-section", Boolean(mechanics?.next_nodes?.length));

  if (!mechanics) return;

  dom.mechanicsDefinition.textContent = mechanics.definition || "";
  dom.mechanicsClinical.textContent = mechanics.clinical || "";
  dom.mechanicsConfusion.textContent = mechanics.confusion || "";

  dom.mechanicsChain.replaceChildren();
  for (const item of mechanics.chain || []) {
    const row = document.createElement("div");
    row.className = "chain-item";
    const content = document.createElement("div");
    const label = document.createElement("b");
    const value = document.createElement("p");
    label.textContent = item.label || "連動";
    value.textContent = item.value || "";
    content.append(label, value);
    row.append(content);
    dom.mechanicsChain.append(row);
  }

  dom.mechanicsReasoning.replaceChildren();
  for (const step of mechanics.reasoning || []) {
    const item = document.createElement("li");
    item.textContent = step;
    dom.mechanicsReasoning.append(item);
  }

  dom.mechanicsNext.replaceChildren();
  for (const next of mechanics.next_nodes || []) {
    const target = nodeById.get(next.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "next-item";
    const label = document.createElement("b");
    const reason = document.createElement("small");
    label.textContent = `→ ${next.label || target?.label || next.id}`;
    reason.textContent = next.reason || "";
    button.append(label, reason);
    button.addEventListener("click", () => {
      if (!target) return;
      selectNode(target.id);
      centerNode(target.id);
    });
    dom.mechanicsNext.append(button);
  }
}

function renderQuiz(nodeId) {
  const questions = FLASHCARDS[nodeId] || [];
  dom.quizCount.textContent = questions.length;
  dom.quizEmpty.hidden = questions.length !== 0;
  dom.quizReset.hidden = questions.length === 0;
  dom.quizList.replaceChildren();

  for (const [questionIndex, question] of questions.entries()) {
    const card = document.createElement("article");
    card.className = "quiz-card";

    const meta = document.createElement("div");
    meta.className = "quiz-meta";
    const category = document.createElement("span");
    const difficulty = document.createElement("span");
    difficulty.className = "difficulty";
    category.textContent = question.category || `題目 ${questionIndex + 1}`;
    difficulty.textContent = `${"●".repeat(Math.max(1, Number(question.difficulty) || 1))} 難度 ${Number(question.difficulty) || 1}`;
    meta.append(category, difficulty);

    const prompt = document.createElement("p");
    prompt.className = "quiz-question";
    prompt.textContent = `${questionIndex + 1}. ${question.question}`;
    card.append(meta, prompt);

    if (question.imageUrl) {
      const image = document.createElement("img");
      image.className = "quiz-image";
      image.src = question.imageUrl;
      image.alt = `題目 ${questionIndex + 1} 圖片`;
      image.loading = "lazy";
      card.append(image);
    }

    const options = document.createElement("div");
    options.className = "quiz-options";
    for (const [optionIndex, option] of (question.options || []).entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.dataset.optionIndex = String(optionIndex);
      const marker = document.createElement("span");
      marker.className = "option-marker";
      marker.textContent = String.fromCharCode(65 + optionIndex);
      const text = document.createElement("span");
      text.textContent = option;
      button.append(marker, text);
      button.addEventListener("click", () => answerQuestion(card, question, optionIndex));
      options.append(button);
    }

    const result = document.createElement("div");
    result.className = "quiz-result";
    const resultLabel = document.createElement("strong");
    resultLabel.textContent = "答案解析";
    const resultText = document.createElement("span");
    resultText.textContent = question.answer || "";
    result.append(resultLabel, resultText);
    card.append(options, result);
    dom.quizList.append(card);
  }
}

function answerQuestion(card, question, selectedIndex) {
  if (card.classList.contains("answered")) return;
  card.classList.add("answered");
  const correctIndex = Number(question.correctIdx);
  card.querySelectorAll(".quiz-option").forEach((button) => {
    const optionIndex = Number(button.dataset.optionIndex);
    button.disabled = true;
    if (optionIndex === correctIndex) {
      button.classList.add("correct");
    } else if (optionIndex === selectedIndex) {
      button.classList.add("wrong");
    } else {
      button.classList.add("dimmed");
    }
  });
}

function selectNode(nodeId, updateHash = true) {
  const node = nodeById.get(nodeId);
  if (!node) return;
  state.selectedId = nodeId;
  for (const [id, element] of nodeElements) {
    element.classList.toggle("selected", id === nodeId);
  }

  for (const record of edgeRecords) {
    const connected = record.source === nodeId || record.target === nodeId;
    record.element.classList.toggle("highlighted", connected);
    record.element.classList.toggle("dimmed", !connected);
  }

  dom.panelEmpty.hidden = true;
  dom.panelContent.hidden = false;
  dom.panelBadge.textContent = `${typeLabel(node.type)} · TREE ${node.tree}`;
  dom.panelBadge.style.color = node.tree === "A" ? "var(--a)" : "var(--b)";
  dom.panelId.textContent = node.id.toUpperCase();
  dom.panelLabel.textContent = node.label;
  dom.panelDescription.textContent = node.fullName || "尚無說明";
  renderMechanics(nodeId);
  renderQuiz(nodeId);

  const incoming = EDGES.filter((edge) => edge.target === nodeId)
    .map((edge) => nodeById.get(edge.source))
    .filter(Boolean);
  const outgoing = EDGES.filter((edge) => edge.source === nodeId)
    .map((edge) => nodeById.get(edge.target))
    .filter(Boolean);
  const bridges = BRIDGES.filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => ({
      node: nodeById.get(edge.source === nodeId ? edge.target : edge.source),
      label: edge.label,
    }))
    .filter((item) => item.node);

  renderRelationList(dom.incoming, incoming, "← ");
  renderRelationList(dom.outgoing, outgoing, "→ ");
  dom.bridgeList.replaceChildren();
  if (!bridges.length) {
    const empty = document.createElement("span");
    empty.className = "none";
    empty.textContent = "無";
    dom.bridgeList.append(empty);
  } else {
    for (const bridge of bridges) {
      const button = relationButton(bridge.node, "⚡ ");
      button.title = bridge.label;
      dom.bridgeList.append(button);
    }
  }

  dom.workspace.classList.add("panel-open");
  requestAnimationFrame(() => {
    dom.panel.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  });
  if (updateHash) history.replaceState(null, "", `#${encodeURIComponent(nodeId)}`);
}

function closePanel() {
  state.selectedId = null;
  dom.workspace.classList.remove("panel-open");
  dom.panelEmpty.hidden = false;
  dom.panelContent.hidden = true;
  for (const element of nodeElements.values()) element.classList.remove("selected");
  for (const record of edgeRecords) record.element.classList.remove("highlighted", "dimmed");
  history.replaceState(null, "", location.pathname + location.search);
}

function typeLabel(type) {
  return (
    {
      root: "起點",
      branch: "分支",
      test: "測試",
      intervention: "介入",
      clinical: "臨床",
      default: "概念",
    }[type] || "概念"
  );
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

function bindControls() {
  document.querySelector("#zoom-in").addEventListener("click", () => setZoom(state.scale * 1.2));
  document.querySelector("#zoom-out").addEventListener("click", () => setZoom(state.scale / 1.2));
  document.querySelector("#fit-view").addEventListener("click", fitView);
  document.querySelector("#panel-close").addEventListener("click", closePanel);
  document.querySelector("#focus-node").addEventListener("click", () => centerNode(state.selectedId));
  dom.quizReset.addEventListener("click", () => {
    if (state.selectedId) renderQuiz(state.selectedId);
  });

  dom.search.addEventListener("input", () => {
    state.query = dom.search.value.trim().toLocaleLowerCase("zh-Hant");
    updateFilters();
  });

  document.querySelectorAll('input[name="tree-filter"]').forEach((input) => {
    input.addEventListener("change", () => {
      input.checked ? state.enabledTrees.add(input.value) : state.enabledTrees.delete(input.value);
      updateFilters();
    });
  });

  document.querySelector("#bridge-filter").addEventListener("change", (event) => {
    state.bridgesVisible = event.currentTarget.checked;
    updateFilters();
  });

  document.querySelectorAll(".type-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      button.classList.toggle("active");
      button.classList.contains("active") ? state.enabledTypes.add(type) : state.enabledTypes.delete(type);
      updateFilters();
    });
  });

  document.querySelector("#reset-filters").addEventListener("click", () => {
    state.enabledTrees = new Set(["A", "B"]);
    state.enabledTypes = new Set(["root", "branch", "test", "intervention", "clinical", "default"]);
    state.bridgesVisible = true;
    state.query = "";
    dom.search.value = "";
    document.querySelectorAll('input[name="tree-filter"], #bridge-filter').forEach((input) => {
      input.checked = true;
    });
    document.querySelectorAll(".type-chip").forEach((button) => button.classList.add("active"));
    updateFilters();
    fitView();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== dom.search) {
      event.preventDefault();
      dom.search.focus();
    }
    if (event.key === "Escape") {
      if (document.activeElement === dom.search) {
        dom.search.blur();
      } else {
        closePanel();
        closeSidebar();
      }
    }
  });

  document.querySelector("#mobile-filter").addEventListener("click", openSidebar);
  document.querySelector("#sidebar-close").addEventListener("click", closeSidebar);
  dom.scrim.addEventListener("click", closeSidebar);
}

function bindCanvasGestures() {
  dom.wrap.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = dom.wrap.getBoundingClientRect();
      setZoom(state.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX - rect.left, event.clientY - rect.top);
    },
    { passive: false },
  );

  dom.wrap.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".tree-node")) return;
    state.pointer = { x: event.clientX - state.x, y: event.clientY - state.y };
    state.dragging = true;
    dom.wrap.classList.add("grabbing");
    dom.wrap.setPointerCapture(event.pointerId);
  });

  dom.wrap.addEventListener("pointermove", (event) => {
    if (!state.dragging || !state.pointer) return;
    state.x = event.clientX - state.pointer.x;
    state.y = event.clientY - state.pointer.y;
    applyTransform();
  });

  const endDrag = () => {
    state.dragging = false;
    state.pointer = null;
    dom.wrap.classList.remove("grabbing");
  };
  dom.wrap.addEventListener("pointerup", endDrag);
  dom.wrap.addEventListener("pointercancel", endDrag);
}

function openSidebar() {
  dom.sidebar.classList.add("open");
  dom.scrim.classList.add("open");
}

function closeSidebar() {
  dom.sidebar.classList.remove("open");
  dom.scrim.classList.remove("open");
}

function initialize() {
  renderEdges();
  renderNodes();
  renderMinimap();
  bindControls();
  bindCanvasGestures();
  updateFilters();
  requestAnimationFrame(() => {
    fitView();
    const hashId = decodeURIComponent(location.hash.slice(1));
    if (hashId && nodeById.has(hashId)) {
      selectNode(hashId, false);
      centerNode(hashId);
    }
  });
  window.addEventListener("resize", fitView);
}

initialize();
