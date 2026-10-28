(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { nodes: [], edges: [], selected: null, detail: "detailed", style: "process", connectMode: false, connectFrom: null, sourceText: "", fileName: "", dragging: null, dragStart: null, moved: false, view: { width: 1000, height: 760 } };
  const NS = "http://www.w3.org/2000/svg";
  const emptyStateMarkup = () => `<div id="emptyState" class="empty-state"><div class="empty-icon">⌘</div><h3>Your ideas will take shape here</h3><p>Paste a passage or upload a document, then generate your first diagram.</p><button id="loadExample" class="text-button">Try a sample about photosynthesis ↗</button></div>`;
  const COLORS = {
    concept: { fill: "#eeedff", stroke: "#b9b4ff", label: "CONCEPT" },
    process: { fill: "#e6f6ed", stroke: "#9bd6b5", label: "STEP" },
    condition: { fill: "#fff4d9", stroke: "#f0cf7c", label: "CONDITION" },
    exception: { fill: "#fff0ee", stroke: "#efb0a9", label: "EXCEPTION" },
    equation: { fill: "#eaf3ff", stroke: "#a8c8f5", label: "EQUATION" },
    outcome: { fill: "#e6f4f7", stroke: "#9bd3dc", label: "OUTCOME" }
  };
  const sample = `Photosynthesis

Photosynthesis is the process by which plants convert light energy into chemical energy.

Chlorophyll in chloroplasts absorbs light energy. The light-dependent reactions use this energy to split water, releasing oxygen and producing ATP and NADPH.

The Calvin cycle uses ATP and NADPH to fix carbon dioxide into organic molecules. The process occurs in the stroma of chloroplasts.

If light is unavailable, the light-dependent reactions cannot continuously produce ATP and NADPH. The Calvin cycle depends on these products, although its individual reactions do not directly require photons.

Factors affecting the rate include light intensity, carbon dioxide concentration, and temperature. Increasing light intensity can increase the rate only up to a saturation point. Very high temperatures may reduce the rate because photosynthetic enzymes can lose activity.

Overall, photosynthesis stores energy in organic compounds and supports most food chains.`;
  const detailLimits = { overview: 7, balanced: 12, detailed: 22 };
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const uid = () => "n" + Math.random().toString(36).slice(2, 10);
  const escapeXml = s => String(s).replace(/[<>&'"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[c]));
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function status(message) { $("status").textContent = message; }
  function splitSentences(text) {
    return text.replace(/\r/g, "").split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).map(clean).filter(s => s.length > 24);
  }
  function classify(text, index, total) {
    const s = text.toLowerCase();
    if (/\b(unless|except|however|in contrast|limitation|although|whereas|but)\b/.test(s)) return "exception";
    if (/\b(if|when|provided that|only if|depends on|requires|condition|provided|as long as)\b/.test(s)) return "condition";
    if (/[=<>≤≥±∑∫]/.test(text) || /\b(equation|formula)\b/.test(s)) return "equation";
    if (/\b(therefore|thus|as a result|consequently|overall|in conclusion|leads to|results in)\b/.test(s) || index === total - 1) return "outcome";
    if (/\b(uses|produces|converts|increases|decreases|forms|releases|generates|occurs|absorbs|causes|split|combine|calculate|measure)\b/.test(s)) return "process";
    return "concept";
  }
  function titleFrom(text) {
    let t = clean(text).replace(/^[•\-*]\s*/, "");
    t = t.replace(/^(however|therefore|thus|overall|in addition|for example|for instance|moreover|consequently),?\s*/i, "");
    if (t.length > 83) {
      const cut = t.slice(0, 80).lastIndexOf(" ");
      t = t.slice(0, cut > 35 ? cut : 80) + "…";
    }
    return t;
  }
  function segment(text) {
    const lines = text.replace(/\r/g, "").split("\n").map(s => s.trim());
    const result = [];
    let currentHeading = "";
    let paragraph = "";
    const flush = () => {
      if (!paragraph.trim()) return;
      const p = clean(paragraph);
      const sentences = splitSentences(p);
      (sentences.length ? sentences : [p]).forEach(s => result.push({ text: s, heading: currentHeading }));
      paragraph = "";
    };
    for (const line of lines) {
      if (!line) { flush(); continue; }
      const isHeading = line.length < 95 && !/[.!?]$/.test(line) && (line === line.toUpperCase() || /^(\d+(\.\d+)*[.)]?\s+|#{1,6}\s+|chapter\s+\d+|abstract|introduction|method(s|ology)?|results|discussion|conclusion|references)\b/i.test(line));
      if (isHeading) { flush(); currentHeading = line.replace(/^#{1,6}\s*/, ""); result.push({ text: currentHeading, heading: currentHeading, isHeading: true }); continue; }
      paragraph += (paragraph ? " " : "") + line.replace(/^[-*•]\s+/, "");
    }
    flush();
    return result;
  }
  function extract(text, detail, style) {
    const units = segment(text);
    const candidates = [];
    const seen = new Set();
    for (const unit of units) {
      const t = clean(unit.text);
      if (unit.isHeading) {
        candidates.push({ text: t, kind: "concept", heading: unit.heading, source: t });
        continue;
      }
      if (t.length < 28) continue;
      const key = t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ text: t, kind: classify(t, candidates.length, units.length), heading: unit.heading, source: t });
    }
    let chosen = candidates;
    if (detail === "overview") chosen = candidates.filter((c, i) => c.kind === "concept" || c.kind === "outcome" || i === 0);
    if (detail === "balanced") chosen = candidates.filter((c, i) => c.kind !== "exception" || i < 15);
    const limit = detailLimits[detail] || 22;
    if (chosen.length > limit) {
      const mustKeep = chosen.filter(c => ["condition", "exception", "equation"].includes(c.kind));
      const rest = chosen.filter(c => !mustKeep.includes(c));
      chosen = [...mustKeep, ...rest].slice(0, limit).sort((a,b) => candidates.indexOf(a) - candidates.indexOf(b));
    }
    if (!chosen.length) return { nodes: [], edges: [] };
    const nodes = chosen.map((c, i) => ({
      id: uid(), kind: c.kind, title: titleFrom(c.text), summary: c.text, source: c.source,
      page: c.page || null, heading: c.heading || "", x: 0, y: 0, width: 230, height: 82,
      confidence: 0.6
    }));
    const edges = [];
    if (style === "hierarchy") {
      // Root-and-branches topology: root fans out to the next-level points.
      // The tree layout makes this visibly different from a sequential process.
      const root = nodes[0];
      nodes.slice(1).forEach(n => edges.push({ id: uid(), source: root.id, target: n.id, label: "" }));
    } else {
      for (let i = 1; i < nodes.length; i++) {
        let label = "then";
        if (nodes[i].kind === "condition") label = "if / when";
        else if (nodes[i].kind === "exception") label = "exception";
        else if (nodes[i].kind === "outcome") label = "therefore";
        else if (style === "concept") label = "relates to";
        edges.push({ id: uid(), source: nodes[i-1].id, target: nodes[i].id, label });
      }
    }
    layout(nodes, edges, style);
    return { nodes, edges };
  }
  function layout(nodes, edges, style) {
    const W = 1000, top = 60, gapY = 32, gapX = 75;
    if (style === "hierarchy" && nodes.length > 1) {
      // Branching tree: root at the top, remaining points arranged in rows beneath it.
      const root = nodes[0];
      root.x = (W - root.width) / 2; root.y = top;
      const children = nodes.slice(1);
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(children.length * 1.4))));
      const cellW = W / cols;
      children.forEach((n, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        n.x = Math.max(10, col * cellW + (cellW - n.width) / 2);
        n.y = top + 190 + row * 150;
      });
    } else if (style === "concept" && nodes.length > 3) {
      // A loose two-column map rather than a long vertical list.
      nodes.forEach((n,i) => { n.x = i % 2 ? 560 : 100; n.y = top + Math.floor(i/2)*125; });
    } else {
      nodes.forEach((n,i) => { n.x = (W - n.width)/2; n.y = top + i*(n.height+gapY); });
    }
    const maxY = Math.max(...nodes.map(n => n.y+n.height), 700);
    state.view = { width: W, height: Math.max(760, maxY+80) };
  }
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
    return el;
  }
  function render() {
    const svg = $("diagram");
    let empty = $("emptyState");
    const has = state.nodes.length > 0;

    // Make the placeholder structurally absent while a diagram exists. This is
    // stronger than relying on CSS/hidden attributes for an absolutely-positioned overlay.
    document.body.classList.toggle("has-diagram", has);
    if (has && empty) {
      empty.remove();
      empty = null;
    } else if (!has && !empty) {
      const holder = document.createElement("template");
      holder.innerHTML = emptyStateMarkup();
      empty = holder.content.firstElementChild;
      svg.parentNode.insertBefore(empty, svg);
      $("loadExample").addEventListener("click", () => {
        $("sourceText").value = sample;
        status("Sample loaded. Generate a flowchart to try FlowSnap.");
      });
    }
    svg.hidden = !has;
    if (has) svg.removeAttribute("hidden");
    svg.style.display = has ? "block" : "none";
    svg.style.visibility = has ? "visible" : "hidden";
    svg.style.opacity = has ? "1" : "0";
    if (!has) { svg.style.height = "100%"; svg.style.aspectRatio = "auto"; svg.style.minHeight = "530px"; }
    ["saveJson","exportSvg","exportPng","addNode","connectMode"].forEach(id => $(id).disabled = !has);
    $("nodeCount").textContent = has ? `${state.nodes.length} nodes · ${state.edges.length} connections` : "No diagram yet";
    if (!has) return;
    svg.setAttribute("viewBox", `0 0 ${state.view.width} ${state.view.height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMin meet");
    // Keep the SVG's rendered height proportional to its viewBox. The old
    // 100%-height SVG inside an overflow-hidden wrapper clipped taller diagrams
    // and could make the generated flowchart appear missing.
    // Give the SVG a concrete rendered height. Some browsers calculate
    // height:auto for inline SVG as its default intrinsic height, even when
    // aspect-ratio is set; that can collapse/clip the diagram after generation.
    const canvasWidth = svg.parentElement.clientWidth || 700;
    const renderedHeight = Math.max(530, Math.ceil(canvasWidth * state.view.height / state.view.width));
    svg.setAttribute("width", String(canvasWidth));
    svg.setAttribute("height", String(renderedHeight));
    svg.style.width = `${canvasWidth}px`;
    svg.style.height = `${renderedHeight}px`;
    svg.style.aspectRatio = "auto";
    svg.style.minHeight = "0";
    svg.style.overflow = "visible";
    const edgesLayer = $("edgesLayer"), nodesLayer = $("nodesLayer");
    edgesLayer.replaceChildren(); nodesLayer.replaceChildren();
    for (const edge of state.edges) {
      const a = state.nodes.find(n => n.id === edge.source), b = state.nodes.find(n => n.id === edge.target);
      if (!a || !b) continue;
      const x1 = a.x+a.width/2, y1 = a.y+a.height;
      const x2 = b.x+b.width/2, y2 = b.y;
      let d;
      if (Math.abs(x1-x2)<25 && y2>y1) {
        const mid = (y1+y2)/2; d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
      } else {
        const sx = a.x+a.width, sy = a.y+a.height/2, tx = b.x, ty = b.y+b.height/2;
        const midX = (sx+tx)/2; d = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
      }
      edgesLayer.appendChild(svgEl("path", { d, class:"edge-path" }));
      if (edge.label) {
        const lx = (x1+x2)/2, ly = (y1+y2)/2;
        const label = svgEl("text", { x:lx+10, y:ly, class:"edge-label" }); label.textContent = edge.label; edgesLayer.appendChild(label);
      }
    }
    for (const node of state.nodes) {
      const group = svgEl("g", { class:`node-shape ${state.selected===node.id?"selected":""} ${state.connectFrom===node.id?"connect-source":""}`, "data-id":node.id, transform:`translate(${node.x} ${node.y})` });
      const color = COLORS[node.kind] || COLORS.concept;
      if (node.kind === "condition") group.appendChild(svgEl("polygon", { points:`${node.width/2},0 ${node.width},${node.height/2} ${node.width/2},${node.height} 0,${node.height/2}`, fill:color.fill, stroke:color.stroke, "stroke-width":1.4, rx:8 }));
      else group.appendChild(svgEl("rect", { x:0,y:0,width:node.width,height:node.height,rx:12,fill:color.fill,stroke:color.stroke,"stroke-width":1.4 }));
      const left = node.kind==="condition" ? 34 : 14;
      const kind = svgEl("text", { x:left,y:19,class:"node-kind" }); kind.textContent = COLORS[node.kind]?.label || "CONCEPT"; group.appendChild(kind);
      const lines = wrap(node.title, 29).slice(0,3);
      lines.forEach((line,i) => { const t = svgEl("text",{x:left,y:40+i*15,class:"node-text"}); t.textContent=line; group.appendChild(t); });
      group.addEventListener("pointerdown", onNodePointerDown);
      group.addEventListener("click", onNodeClick);
      nodesLayer.appendChild(group);
    }
    if (state.selected) fillInspector();
    $("connectMode").classList.toggle("button-primary", state.connectMode);
    $("connectMode").textContent = state.connectMode ? "Cancel connection" : "＋ Connect nodes";
    $("connectHint").textContent = state.connectMode ? "Select a source node, then a target node." : "";
  }
  function wrap(s, max) {
    const words = String(s).split(/\s+/), lines=[]; let line="";
    for (const word of words) { if ((line+" "+word).trim().length>max && line) { lines.push(line); line=word; } else line=(line+" "+word).trim(); }
    if(line) lines.push(line); return lines;
  }
  function getSvgPoint(evt) {
    const svg = $("diagram"), pt = svg.createSVGPoint(); pt.x=evt.clientX; pt.y=evt.clientY;
    const matrix = svg.getScreenCTM(); return matrix ? pt.matrixTransform(matrix.inverse()) : {x:0,y:0};
  }
  function onNodePointerDown(evt) {
    if (state.connectMode) return;
    const group = evt.currentTarget, id = group.dataset.id, node = state.nodes.find(n=>n.id===id);
    if (!node) return;
    evt.preventDefault();
    // Select on pointer-down so selection works reliably even when SVG click events
    // are swallowed by pointer capture or a browser's drag gesture.
    state.selected = id;
    document.querySelectorAll(".node-shape").forEach(el => el.classList.toggle("selected", el.dataset.id === id));
    fillInspector();
    try { group.setPointerCapture(evt.pointerId); } catch (_) {}
    state.dragging=id; state.dragStart=getSvgPoint(evt); state.moved=false;
    group.addEventListener("pointermove", onPointerMove);
    group.addEventListener("pointerup", onPointerUp, { once:true });
  }
  function onPointerMove(evt) {
    if (!state.dragging) return;
    const pt=getSvgPoint(evt), dx=pt.x-state.dragStart.x, dy=pt.y-state.dragStart.y;
    if (Math.abs(dx)+Math.abs(dy)>2) state.moved=true;
    const n=state.nodes.find(n=>n.id===state.dragging); if(!n)return;
    n.x=Math.max(0,n.x+dx); n.y=Math.max(0,n.y+dy); state.dragStart=pt;
    const g=$("nodesLayer").querySelector(`[data-id="${state.dragging}"]`);
    if(g) g.setAttribute("transform",`translate(${n.x} ${n.y})`);
    renderEdgesOnly();
  }
  function onPointerUp(evt) {
    evt.currentTarget.removeEventListener("pointermove", onPointerMove);
    state.dragging=null; state.dragStart=null;
  }
  function renderEdgesOnly() {
    // Re-rendering is intentionally small: edge geometry only while dragging.
    const edgesLayer=$("edgesLayer"); edgesLayer.replaceChildren();
    for(const e of state.edges){
      const a=state.nodes.find(n=>n.id===e.source),b=state.nodes.find(n=>n.id===e.target);if(!a||!b)continue;
      const x1=a.x+a.width/2,y1=a.y+a.height,x2=b.x+b.width/2,y2=b.y;
      const d=`M ${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}`;
      edgesLayer.appendChild(svgEl("path",{d,class:"edge-path"}));
      if(e.label){const t=svgEl("text",{x:(x1+x2)/2+10,y:(y1+y2)/2,class:"edge-label"});t.textContent=e.label;edgesLayer.appendChild(t);}
    }
  }
  function onNodeClick(evt) {
    evt.stopPropagation();
    const id=evt.currentTarget.dataset.id;
    if(state.moved){state.moved=false;return;}
    if(state.connectMode){
      if(!state.connectFrom){state.connectFrom=id;state.selected=id;render();return;}
      if(state.connectFrom===id){state.connectFrom=null;render();return;}
      if(!state.edges.some(e=>e.source===state.connectFrom&&e.target===id)){
        state.edges.push({id:uid(),source:state.connectFrom,target:id,label:"relates to"});
      }
      state.connectFrom=null;state.connectMode=false;state.selected=id;render();toast("Connection added. Select the target node to edit its incoming label.");return;
    }
    state.selected=id;render();
  }
  function fillInspector() {
    const n=state.nodes.find(n=>n.id===state.selected);
    $("inspectorEmpty").hidden=!!n; $("inspectorForm").hidden=!n;
    if(!n)return;
    $("nodeTitle").value=n.title; $("nodeSummary").value=n.summary||"";
    $("nodeType").value=n.kind; $("sourceExcerpt").textContent=n.source||n.summary||"No source excerpt available.";
    $("sourcePage").textContent=n.page?`Page ${n.page}`:"Source";
  }
  function updateSelected() {
    const n=state.nodes.find(n=>n.id===state.selected);if(!n)return;
    n.title=$("nodeTitle").value.trim()||"Untitled point";
    n.summary=$("nodeSummary").value; n.kind=$("nodeType").value;
    render();
  }
  function generate() {
    const text=$("sourceText").value.trim();
    if(!text){status("Paste text or upload a document first.");toast("Add some source text first.");return;}
    state.sourceText=text; state.detail=document.querySelector("[data-detail].active")?.dataset.detail||"detailed"; state.style=$("diagramStyle").value;
    status("Extracting important points…");
    const graph=extract(text,state.detail,state.style);
    state.nodes=graph.nodes;state.edges=graph.edges;state.selected=state.nodes[0]?.id||null;state.connectMode=false;state.connectFrom=null;
    render();status(`Generated ${state.nodes.length} nodes and ${state.edges.length} connections. Review the source before relying on the diagram.`);
    if(!state.nodes.length)toast("Couldn't find enough text. Try a longer passage.");
  }
  async function readFile(file) {
    if(!file)return;
    $("fileName").textContent=file.name; status(`Reading ${file.name}…`);
    try {
      const ext=file.name.split(".").pop().toLowerCase(); let text="";
      if(ext==="txt"||ext==="md") text=await file.text();
      else if(ext==="pdf"){
        if(!window.pdfjsLib) throw new Error("PDF reader is still loading. Try again in a moment or paste text.");
        pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        const pages=[];
        for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(`\n[Page ${i}]\n`+content.items.map(x=>x.str).join(" "));}
        text=pages.join("\n");
      } else if(ext==="docx"){
        if(!window.mammoth) throw new Error("DOCX reader is still loading. Try again in a moment or paste text.");
        const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});text=result.value;
      } else throw new Error("Unsupported file type. Use TXT, MD, PDF, or DOCX.");
      $("sourceText").value=text;state.fileName=file.name;status(`Loaded ${file.name} (${text.length.toLocaleString()} characters). Check the extracted text, then generate a flowchart.`);
      toast("Document text extracted.");
    } catch(e){status(e.message||"Couldn't read that file.");toast(e.message||"File could not be read.");}
  }
  function download(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function projectData(){return {app:"FlowSnap",version:1,title:state.fileName||"FlowSnap project",sourceText:state.sourceText,nodes:state.nodes,edges:state.edges,view:state.view,exportedAt:new Date().toISOString()};}
  function exportSvg() {
    const source=$("diagram").cloneNode(true);source.removeAttribute("hidden");source.setAttribute("xmlns",NS);
    source.querySelectorAll(".selected,.connect-source").forEach(el=>el.classList.remove("selected","connect-source"));
    source.querySelectorAll(".node-shape").forEach(el=>{el.style.cursor="default";});
    const css=`<style>.node-text{font:700 12px Arial,sans-serif;fill:#263147}.node-kind{font:9px Arial,sans-serif;fill:#6b7280}.edge-path{fill:none;stroke:#9ba5b5;stroke-width:1.6;marker-end:url(#arrowhead)}.edge-label{font:10px Arial,sans-serif;fill:#667085;paint-order:stroke;stroke:#fcfcff;stroke-width:4px}</style>`;
    source.insertAdjacentHTML("afterbegin",css);
    source.setAttribute("width",state.view.width);source.setAttribute("height",state.view.height);
    const bg=svgEl("rect",{x:0,y:0,width:state.view.width,height:state.view.height,fill:"#fcfcff"});source.insertBefore(bg,source.firstChild);
    download(new Blob([new XMLSerializer().serializeToString(source)],{type:"image/svg+xml;charset=utf-8"}),"flowsnap-diagram.svg");
  }
  function exportPng() {
    const source=$("diagram").cloneNode(true);source.removeAttribute("hidden");source.setAttribute("xmlns",NS);
    source.setAttribute("width",state.view.width);source.setAttribute("height",state.view.height);
    const svgText=new XMLSerializer().serializeToString(source),blob=new Blob([svgText],{type:"image/svg+xml;charset=utf-8"}),url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{const canvas=document.createElement("canvas");canvas.width=state.view.width*2;canvas.height=state.view.height*2;const ctx=canvas.getContext("2d");ctx.scale(2,2);ctx.fillStyle="#fcfcff";ctx.fillRect(0,0,state.view.width,state.view.height);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);canvas.toBlob(png=>download(png,"flowsnap-diagram.png"));};
    img.onerror=()=>{URL.revokeObjectURL(url);toast("PNG export failed. Try SVG export instead.");};img.src=url;
  }
  $("generate").addEventListener("click",generate);
  $("fileInput").addEventListener("change",e=>readFile(e.target.files[0]));
  document.querySelectorAll("[data-detail]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-detail]").forEach(b=>b.classList.toggle("active",b===btn));state.detail=btn.dataset.detail;}));
  $("diagramStyle").addEventListener("change",e=>state.style=e.target.value);
  $("loadExample").addEventListener("click",()=>{$("sourceText").value=sample;status("Sample loaded. Generate a flowchart to try FlowSnap.");});
  $("addNode").addEventListener("click",()=>{const node={id:uid(),kind:"concept",title:"New important point",summary:"Add supporting detail here.",source:"Manually added node — no source excerpt.",x:100,y:Math.max(60,...state.nodes.map(n=>n.y+n.height+28)),width:230,height:82};state.nodes.push(node);state.selected=node.id;state.view.height=Math.max(state.view.height,node.y+160);render();});
  $("connectMode").addEventListener("click",()=>{state.connectMode=!state.connectMode;state.connectFrom=null;render();});
  $("nodeTitle").addEventListener("input",updateSelected);$("nodeSummary").addEventListener("input",updateSelected);$("nodeType").addEventListener("change",updateSelected);
  $("deleteNode").addEventListener("click",()=>{if(!state.selected)return;state.nodes=state.nodes.filter(n=>n.id!==state.selected);state.edges=state.edges.filter(e=>e.source!==state.selected&&e.target!==state.selected);state.selected=state.nodes[0]?.id||null;render();toast("Node deleted.");});
  $("saveJson").addEventListener("click",()=>download(new Blob([JSON.stringify(projectData(),null,2)],{type:"application/json"}),"flowsnap-project.json"));
  $("exportSvg").addEventListener("click",exportSvg);$("exportPng").addEventListener("click",exportPng);
  $("projectInput").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.app!=="FlowSnap"||!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw new Error("This doesn't look like a FlowSnap project.");state.nodes=data.nodes;state.edges=data.edges;state.sourceText=data.sourceText||"";state.view=data.view||state.view;state.selected=state.nodes[0]?.id||null;$("sourceText").value=state.sourceText;render();status("Project loaded.");toast("Project opened.");}catch(err){toast(err.message||"Couldn't open project.");}e.target.value="";});
  // Clicking the canvas background clears selection.
  $("diagram").addEventListener("click",e=>{if(e.target.id==="diagram"){state.selected=null;render();}});
  // Recompute the SVG's concrete height when the canvas width changes.
  window.addEventListener("resize", () => { if (state.nodes.length) render(); });
  status("Ready. Paste text or load the sample to begin.");
})();
